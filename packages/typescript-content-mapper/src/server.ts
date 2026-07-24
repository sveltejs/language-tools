import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte2tsx, internalHelpers, SvelteCompiledToTsx } from 'svelte2tsx';
import ts from 'typescript';
import { createMessageConnection } from 'vscode-jsonrpc';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import { writeFile, writeFileSync } from 'node:fs';

function startServer() {
    const connection = createMessageConnection(
        new StreamMessageReader(process.stdin),
        new StreamMessageWriter(process.stdout)
    );

    connection.onRequest('initialize', (v: InitializeParams) => {
        const result: InitializeResult = {
            protocolVersion: 1,
            positionEncoding: 'utf-16',
            diagnosticSource: 'svelte'
        };
        return result;
    });
    
    const globalTypesCache = new Map<string, string[]>();

    connection.onRequest('transform', async (v: TransformParams): Promise<TransformResult> => {
        const { fileName, content, configFileName, compilerOptions } = v;

        const compilerPath = import.meta.resolve('svelte/compiler', configFileName);
        const compiler = await import(compilerPath);
        const isTsFile = /<script\s+[^>]*?lang=('|")(ts|typescript)('|")/.test(content);
        let globalTypes = globalTypesCache.get(configFileName);
        if (!globalTypes) {
            globalTypes = internalHelpers.get_global_types(
                ts.sys,
                compiler.VERSION.split('.')[0] === '3',
                path.dirname(fileURLToPath(import.meta.resolve('svelte/package.json'))),
                path.dirname(fileURLToPath(import.meta.resolve('svelte2tsx'))),
                configFileName
            );
            globalTypesCache.set(configFileName, globalTypes);
        }
        try {
            const res = svelte2tsx(content, {
                filename: fileName,
                isTsFile: isTsFile,
                emitOnTemplateError: true,
                emitJsDoc: true,
                namespace: 'svelteHTML',
                parse: compiler.parse,
                version: compiler.VERSION,
                shimPaths: globalTypes,
                sourcemap: {
                    format: 'decoded',
                    hires: 'boundary'
                }
            });

            const mappings: SpanMapping[] = convertMapping(res, content);

            return {
                text: res.code,
                scriptKind: isTsFile ? ScriptKind.TS : ScriptKind.JS,
                mappings: mappings.filter((m) => m[ORIGINAL_LENGTH] > 0),
                diagnostics: []
            };
        } catch (error) {
            return {
                text: '',
                scriptKind: isTsFile ? ScriptKind.TS : ScriptKind.JS,
                mappings: [],
                diagnostics: [
                    {
                        messageText: (error as Error).message,
                        // TODO
                        start: 0,
                        length: 0,
                        source: 'svelte'
                    }
                ]
            };
        }
    });
    connection.listen();
}

startServer();

type PositionEncoding = 'utf-8' | 'utf-16';

interface InitializeParams {
    protocolVersion: 1;
    /** The position encodings supported by TypeScript. The mapper must choose one of these encodings. */
    positionEncodings: PositionEncoding[];
    /** BCP 47 locale requested for diagnostics. */
    locale?: string;
}

interface InitializeResult {
    /** Must match the protocolVersion sent in InitializeParams. */
    protocolVersion: 1;
    /** The position encoding the mapper will use for all span mapping positions and diagnostic positions. */
    positionEncoding: PositionEncoding;
    diagnosticSource: string;
}

interface TransformParams {
    fileName: string;
    /** Original content of the file to be transformed. */
    content: string;
    configFileName: string;
    /** The subset of compiler options that the mapper requested in its package.json. */
    compilerOptions: Record<string, unknown>;
}

interface TransformResult {
    /** Valid JS, JSX, TS, TSX, or JSON text that TypeScript can parse, according to the specified `scriptKind`. */
    text: string;
    /** The kind of syntax returned in `text`. Defaults to `ScriptKind.TS` if not specified. */
    scriptKind?: ScriptKind;
    /** Mappings between the original and transformed content. */
    mappings?: SpanMapping[];
    /**
     * Parse errors in the original content that prevent the mapper from producing a successful transform.
     * If present, TypeScript will not parse `text` or use `mappings`. Like TypeScript parse errors, they
     * prevent any type checking from occurring in the file.
     */
    diagnostics?: MapperDiagnostic[];
}

/** Positions and lengths are in the specified `positionEncoding`. */
type SpanMapping = [
    generatedStart: number,
    generatedLength: number,
    originalStart: number,
    originalLength: number,
    kind: SpanMapKind,
    purpose?: SpanMapPurpose
];

enum ScriptKind {
    JS = 1,
    JSX = 2,
    TS = 3,
    TSX = 4,
    JSON = 6
}

enum SpanMapKind {
    /** Verbatim spans in generated output have the same length and content as their counterparts in original text. */
    Verbatim = 0,
    /** Atom spans in generated output may have different length and content than their counterparts in the original text. */
    Atom = 1,
    /** Alias spans in generated output may have different length and content than their counterparts in the original text, but diagnostics display their original text. */
    Alias = 2
}

/**
 * SpanMapPurpose controls which TypeScript language service features will activate using a span
 * in the transformed content given a request position in the original content.
 */
enum SpanMapPurpose {
    /** Disables all language service features for the span. */
    None = 0,
    /** Used by features that inspect semantic information, such as hover, signature help, and completions. */
    Semantic = 1 << 0,
    /** Used by features that locate symbols, such as definitions, references, rename, and call hierarchy. */
    Navigation = 1 << 1,
    /** Enables both semantic and navigation features. This is the default when `purpose` is omitted. */
    All = Semantic | Navigation
}

/** Start and length are in the specified `positionEncoding`. */
interface MapperDiagnostic {
    messageText: string;
    start: number;
    length: number;
    code?: number;
    source?: string;
}

const GENERATE_START = 0;
const GENERATE_LENGTH = 1;
const ORIGINAL_START = 2;
const ORIGINAL_LENGTH = 3;
const KIND = 4;
const PURPOSE = 5;

function convertMapping(res: SvelteCompiledToTsx<'decoded'>, content: string) {
    const map = res.map.mappings;
    const lineOffsets = getLineOffsets(res.code);
    const orgLineOffsets = getLineOffsets(content);
    const mappings: SpanMapping[] = [];

    // writeFileSync(
    //     fileName.replace('.svelte', 'rawMapping.json'),
    //     JSON.stringify(map, null, 2)
    // );
    // writeFileSync(fileName.replace('.svelte', '._____.ts'), res.code);
    let debugOutput = '';
    let lastOffset = 0;
    for (let generatedLine = 0; generatedLine < map.length; generatedLine++) {
        const line = map[generatedLine];

        let current: SpanMapping | undefined;
        for (const segment of line) {
            const [generatedCharacter, , originalLine, originalCharacter] = segment;
            if (originalLine === undefined || originalCharacter === undefined) {
                continue;
            }

            const generatedStart = lineOffsets[generatedLine] + generatedCharacter;
            const originalStart = orgLineOffsets[originalLine] + originalCharacter;
            if (current) {
                const newSourceEnd = originalStart;
                if (newSourceEnd > current[ORIGINAL_START] + current[3]) {
                    // debugOutput += res.code.slice(lastOffset, generatedStart) + `/*e:${originalStart}*/`;
                    lastOffset = generatedStart;
                    const generatedLength = generatedStart - current[GENERATE_START];
                    const originLength = newSourceEnd - current[ORIGINAL_START];
                    current[GENERATE_LENGTH] = generatedLength;
                    current[3] = originLength;
                }
            }
            current = [generatedStart, 1, originalStart, 1, SpanMapKind.Atom];
            mappings.push(current);
            // debugOutput += res.code.slice(lastOffset, generatedStart) + `/*s:${originalStart}*/`;
            lastOffset = generatedStart;
        }
    }
    // writeFileSync(fileName.replace('.svelte', 'debugMapping.ts'), debugOutput);
    mappings.sort((a, b) => a[ORIGINAL_START] - b[ORIGINAL_START]);
    for (let i = 0; i < mappings.length - 1; i++) {
        const current = mappings[i];
        const next = mappings[i + 1];
        const currentEnd = current[ORIGINAL_START] + current[3];
        if (currentEnd > next[ORIGINAL_START]) {
            current[ORIGINAL_LENGTH] = next[ORIGINAL_START] - current[ORIGINAL_START];
        }

        if (exact(current)) {
            current[KIND] = SpanMapKind.Verbatim;
        }
    }
    return mappings;

    function exact(mapping: SpanMapping) {
        const generatedLength = mapping[GENERATE_LENGTH];
        const originLength = mapping[ORIGINAL_LENGTH];
        if (generatedLength !== originLength) {
            return false;
        }
        for (let i = 0; i < generatedLength; i++) {
            const generatedChar = res.code[mapping[GENERATE_START] + i];
            const originalChar = content[mapping[ORIGINAL_START] + i];
            if (generatedChar !== originalChar) {
                return false;
            }
        }

        return true;
    }
}

function getLineOffsets(text: string) {
    const lineOffsets = [];
    let isLineStart = true;

    for (let i = 0; i < text.length; i++) {
        if (isLineStart) {
            lineOffsets.push(i);
            isLineStart = false;
        }
        const ch = text.charAt(i);
        isLineStart = ch === '\r' || ch === '\n';
        if (ch === '\r' && i + 1 < text.length && text.charAt(i + 1) === '\n') {
            i++;
        }
    }

    if (isLineStart && text.length > 0) {
        lineOffsets.push(text.length);
    }

    return lineOffsets;
}
