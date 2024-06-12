import { decode } from '@jridgewell/sourcemap-codec';
import { forEachEmbeddedCode, type CodeMapping, type LanguagePlugin, type VirtualCode } from '@volar/language-core';
import { svelte2tsx } from 'svelte2tsx';
import type * as ts from 'typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

export const svelteLanguagePlugin: LanguagePlugin<string | URI> = {
    getLanguageId(fileNameOrUri) {
        const path = typeof fileNameOrUri === 'string' ? fileNameOrUri : fileNameOrUri.path;
        if (path.endsWith('.svelte')) {
            return 'svelte';
        }
    },
    createVirtualCode(_fileNameOrUri, languageId, snapshot) {
        if (languageId === 'svelte') {
            return {
                id: 'root',
                languageId,
                snapshot,
                embeddedCodes: [
                    ...getEmbeddedCssCodes(snapshot.getText(0, snapshot.getLength())),
                    getEmbeddedTsCode(snapshot.getText(0, snapshot.getLength())),
                ].filter((v): v is VirtualCode => !!v),
                mappings: [],
                codegenStacks: []
            };
        }
    },
    updateVirtualCode(_fileNameOrUri, virtualCode, snapshot) {
        virtualCode.snapshot = snapshot;
        virtualCode.embeddedCodes = [
            ...getEmbeddedCssCodes(snapshot.getText(0, snapshot.getLength())),
            getEmbeddedTsCode(snapshot.getText(0, snapshot.getLength())),
        ].filter((v): v is VirtualCode => !!v);
        return virtualCode;
    },
    typescript: {
        extraFileExtensions: [{
            extension: 'svelte',
            isMixedContent: true,
            scriptKind: 7 satisfies ts.ScriptKind.Deferred,
        }],
        getServiceScript(root) {
            for (const code of forEachEmbeddedCode(root)) {
                if (code.id === 'ts') {
                    return {
                        code,
                        scriptKind: 3,
                        extension: '.ts',
                    };
                }
            }
        },
    },
};

function* getEmbeddedCssCodes(content: string): Generator<VirtualCode> {

    const styleBlocks = [...content.matchAll(/\<style\b[\s\S]*?\>([\s\S]*?)\<\/style\>/g)];

    for (let i = 0; i < styleBlocks.length; i++) {
        const styleBlock = styleBlocks[i];
        if (styleBlock.index !== undefined) {
            const matchText = styleBlock[1];
            yield {
                id: 'css_' + i,
                languageId: 'css',
                snapshot: {
                    getText(start, end) {
                        return matchText.substring(start, end);
                    },
                    getLength() {
                        return matchText.length;
                    },
                    getChangeRange() {
                        return undefined;
                    },
                },
                mappings: [
                    {
                        sourceOffsets: [styleBlock.index + styleBlock[0].indexOf(matchText)],
                        generatedOffsets: [0],
                        lengths: [matchText.length],
                        data: {
                            verification: true,
                            completion: true,
                            semantic: true,
                            navigation: true,
                            structure: true,
                            format: false,
                        },
                    }
                ],
                embeddedCodes: [],
            }
        }
    }

}

function getEmbeddedTsCode(text: string): VirtualCode | undefined {

    try {
        const tsx = svelte2tsx(text, {
            isTsFile: true,
            mode: 'ts',
        });
        const v3Mappings = decode(tsx.map.mappings);
        const document = TextDocument.create('', 'svelte', 0, text);
        const generateDocument = TextDocument.create('', 'typescript', 0, tsx.code);
        const mappings: CodeMapping[] = [];

        let current: {
            genOffset: number,
            sourceOffset: number,
        } | undefined;

        for (let genLine = 0; genLine < v3Mappings.length; genLine++) {
            for (const segment of v3Mappings[genLine]) {
                const genCharacter = segment[0];
                const genOffset = generateDocument.offsetAt({ line: genLine, character: genCharacter });
                if (current) {
                    let length = genOffset - current.genOffset;
                    const sourceText = text.substring(current.sourceOffset, current.sourceOffset + length);
                    const genText = tsx.code.substring(current.genOffset, current.genOffset + length);
                    if (sourceText !== genText) {
                        length = 0;
                        for (let i = 0; i < genOffset - current.genOffset; i++) {
                            if (sourceText[i] === genText[i]) {
                                length = i + 1;
                            }
                            else {
                                break;
                            }
                        }
                    }
                    if (length > 0) {
                        const lastMapping = mappings.length ? mappings[mappings.length - 1] : undefined;
                        if (
                            lastMapping &&
                            lastMapping.generatedOffsets[0] + lastMapping.lengths[0] === current.genOffset &&
                            lastMapping.sourceOffsets[0] + lastMapping.lengths[0] === current.sourceOffset
                        ) {
                            lastMapping.lengths[0] += length;
                        }
                        else {
                            mappings.push({
                                sourceOffsets: [current.sourceOffset],
                                generatedOffsets: [current.genOffset],
                                lengths: [length],
                                data: {
                                    verification: true,
                                    completion: true,
                                    semantic: true,
                                    navigation: true,
                                    structure: false,
                                    format: false,
                                },
                            });
                        }
                    }
                    current = undefined;
                }
                if (segment[2] !== undefined && segment[3] !== undefined) {
                    const sourceOffset = document.offsetAt({ line: segment[2], character: segment[3] });
                    current = {
                        genOffset,
                        sourceOffset,
                    };
                }
            }
        }

        return {
            id: 'ts',
            languageId: 'typescript',
            snapshot: {
                getText(start, end) {
                    return tsx.code.substring(start, end);
                },
                getLength() {
                    return tsx.code.length;
                },
                getChangeRange() {
                    return undefined;
                },
            },
            mappings: mappings,
            embeddedCodes: [],
        };
    } catch { }
}
