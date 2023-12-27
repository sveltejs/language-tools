import { decode } from '@jridgewell/sourcemap-codec';
import type { CodeMapping, LanguagePlugin, VirtualFile } from '@volar/language-core';
import { svelte2tsx } from 'svelte2tsx';
import type * as ts from 'typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

export const svelteLanguagePlugin: LanguagePlugin = {
	createVirtualFile(fileName, languageId, snapshot) {
		if (languageId === 'svelte') {
			return {
				fileName,
				languageId,
				snapshot,
				embeddedFiles: [
					...getVirtualCssFiles(fileName, snapshot.getText(0, snapshot.getLength())),
					getVirtualTsFile(fileName, snapshot.getText(0, snapshot.getLength())),
				].filter((v): v is VirtualFile => !!v),
				mappings: [],
				codegenStacks: []
			};
		}
	},
	updateVirtualFile(svelteFile, snapshot) {
		svelteFile.snapshot = snapshot;
		svelteFile.embeddedFiles = [
			...getVirtualCssFiles(svelteFile.fileName, snapshot.getText(0, snapshot.getLength())),
			getVirtualTsFile(svelteFile.fileName, snapshot.getText(0, snapshot.getLength())),
		].filter((v): v is VirtualFile => !!v);
	},
	typescript: {
		extraFileExtensions: [{
			extension: 'svelte',
			isMixedContent: true,
			scriptKind: 7 satisfies ts.ScriptKind.Deferred,
		}],
		resolveSourceFileName(tsFileName) {
			if (tsFileName.endsWith('.svelte.ts')) {
				return tsFileName.substring(0, tsFileName.length - '.ts'.length);
			}
		},
		resolveModuleName(moduleName, impliedNodeFormat) {
			if (impliedNodeFormat === 99 satisfies ts.ModuleKind.ESNext && moduleName.endsWith('.svelte')) {
				return `${moduleName}.js`;
			}
		},
	},
};

function* getVirtualCssFiles(fileName: string, content: string): Generator<VirtualFile> {

	const styleBlocks = [...content.matchAll(/\<style\b[\s\S]*?\>([\s\S]*?)\<\/style\>/g)];

	for (let i = 0; i < styleBlocks.length; i++) {
		const styleBlock = styleBlocks[i];
		if (styleBlock.index !== undefined) {
			const matchText = styleBlock[1];
			yield {
				fileName: fileName + '.' + i + '.css',
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
				embeddedFiles: [],
			}
		}
	}

}

function getVirtualTsFile(fileName: string, text: string): VirtualFile | undefined {

	try {
		const tsx = svelte2tsx(text, {
			filename: fileName,
			isTsFile: true,
			mode: 'ts',
		});
		const v3Mappings = decode(tsx.map.mappings);
		const document = TextDocument.create(URI.file(fileName).toString(), 'svelte', 0, text);
		const generateDocument = TextDocument.create(URI.file(fileName + '.ts').toString(), 'typescript', 0, tsx.code);
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
			fileName: fileName + '.ts',
			languageId: 'typescript',
			typescript: {
				scriptKind: 3,
			},
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
			embeddedFiles: [],
		};
	} catch { }
}
