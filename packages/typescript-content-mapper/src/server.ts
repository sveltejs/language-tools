import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from '@sveltejs/load-config';
import { svelte2tsx, internalHelpers } from 'svelte2tsx';
import ts from 'typescript';
import { createMessageConnection } from 'vscode-jsonrpc';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';

// Override console.log to prevent logging to stdout
// This is important because the client/server communicates with the client via stdout, and logging to stdout would interfere with this communication
console.log = (...args) => console.warn('[log]', ...args);

function startServer() {
    const connection = createMessageConnection(
        new StreamMessageReader(process.stdin),
        new StreamMessageWriter(process.stdout)
    );

    connection.onRequest('initialize', (v: InitializeParams) => {
        const result: InitializeResult = {
            positionEncoding: 'utf-16',
            diagnosticSource: 'svelte'
        };
        return result;
    });

    const projectMap = new Map<string, ProjectInfo>();

    connection.onRequest('openProject', (v: OpenProjectParams): OpenProjectResult => {
        projectMap.set(v.projectHandle, {
            params: v,
            typingsNamespace: getTypingsNamespace(v.configFileName)
        });
        return {};
    });

    connection.onRequest('closeProject', (v: CloseProjectParams) => {
        projectMap.delete(v.projectHandle);
        return {};
    });
    const globalTypesCache = new Map<string, string[]>();
    const require = createRequire(import.meta.url);

    connection.onRequest('transform', async (v: TransformParams): Promise<TransformResult> => {
        const { fileName, content } = v;

        let scriptTags: ReturnType<typeof internalHelpers.extractScriptTags> | undefined;
        let extension: '.ts' | '.js' = '.js';

        try {
            const projectInfo = projectMap.get(v.projectHandle);
            // In the inferred project, projectInfo isn't undefined and configFileName is empty string
            const resolveTarget = projectInfo?.params.configFileName || fileName;
            const resolveConfig = {
                paths: [path.dirname(resolveTarget), path.dirname(fileURLToPath(import.meta.url))]
            };
            const compilerPath = require.resolve('svelte/compiler', resolveConfig);
            const { default: compiler } = await import(pathToFileURL(compilerPath).toString());

            scriptTags = internalHelpers.extractScriptTags(content, {
                parse: compiler.parse,
                svelte5Plus: Number(compiler.VERSION.split('.')[0]) >= 5
            });
            extension = getScriptExtension(scriptTags);

            let globalTypes = globalTypesCache.get(resolveTarget);
            const isSvelte3 = compiler.VERSION.split('.')[0] === '3';
            if (!globalTypes) {
                globalTypes = internalHelpers.get_global_types(
                    ts.sys,
                    isSvelte3,
                    path.dirname(require.resolve('svelte/package.json', resolveConfig)),
                    path.dirname(require.resolve('svelte2tsx')),
                    resolveTarget
                );
                globalTypesCache.set(resolveTarget, globalTypes);
            }
            const svelteOptions = await getSvelteCompilerOptions(projectInfo, fileName);
            const res = svelte2tsx(content, {
                filename: fileName,
                isTsFile: extension === '.ts',
                emitOnTemplateError: true,
                emitJsDoc: true,
                namespace:
                    typeof svelteOptions.namespace === 'string'
                        ? svelteOptions.namespace
                        : undefined,
                typingsNamespace: projectInfo?.typingsNamespace ?? DEFAULT_TYPINGS_NAMESPACE,
                accessors: getAccessors(svelteOptions, fileName),
                parse: compiler.parse,
                version: compiler.VERSION,
                shimPaths: globalTypes,
                generateSpanMapping: true,
                // @ts-expect-error internal
                noSvelteComponentTyped: !isSvelte3
            });
            // invalid segments or directives that svelte2tsx dropped (a bug), the rest still works
            const spanMapIssues: string[] | undefined = (res as any).spanMapIssues;
            if (spanMapIssues) {
                console.warn(`Invalid span map for ${fileName}:\n${spanMapIssues.join('\n')}`);
            }

            return {
                text: res.code,
                extension,
                mappings: res.spanMappings ?? [],
                diagnosticDirectives: res.diagnosticDirectives,
                diagnostics: []
            };
        } catch (error: any) {
            scriptTags ??= internalHelpers.extractScriptTags(content);
            extension = getScriptExtension(scriptTags);
            const lineOffsets = getLineOffsets(content);
            const diagnostics: MapperDiagnostic = {
                messageText: (error as Error).message,
                start: 0,
                length: 0,
                code: -1
            };
            if (error.start != null) {
                diagnostics.start = offsetAt(
                    {
                        line: (error.start?.line ?? 1) - 1,
                        character: error.start?.column ?? 0
                    },
                    content,
                    lineOffsets
                );
            }
            if (error.end != null) {
                const length =
                    offsetAt(
                        {
                            line: (error.end?.line ?? 1) - 1,
                            character: error.end?.column ?? 0
                        },
                        content,
                        lineOffsets
                    ) - diagnostics.start;
                diagnostics.length = Math.max(0, length);
            }

            const script = scriptTags.instance ?? scriptTags.module;
            if (!script) {
                return {
                    text: '',
                    extension,
                    mappings: [],
                    diagnostics: [diagnostics]
                };
            }

            const length = script.content.end - script.content.start;
            return {
                text: content.slice(script.content.start, script.content.end),
                extension,
                mappings: [[0, length, script.content.start, length, SpanMapKind.Verbatim]],
                diagnostics: [diagnostics]
            };
        }
    });
    connection.listen();
}

startServer();

interface ProjectInfo {
    params: OpenProjectParams;
    /** The namespace of the element typings (`svelteOptions.namespace` of the tsconfig) */
    typingsNamespace: string;
    /** The Svelte config of the project, loaded on the first transform */
    svelteOptions?: Promise<SvelteCompilerOptions>;
}

const DEFAULT_TYPINGS_NAMESPACE = 'svelteHTML';

/**
 * `svelteOptions.namespace` of the tsconfig, e.g. `svelteNative` for Svelte Native. TS doesn't pass
 * it along (it's not a compiler option). Like TS6, only the tsconfig itself counts, not the ones it
 * extends.
 */
function getTypingsNamespace(configFileName: string): string {
    if (configFileName) {
        const { config } = ts.readConfigFile(configFileName, ts.sys.readFile);
        const namespace = config?.svelteOptions?.namespace;
        if (typeof namespace === 'string' && namespace) {
            return namespace;
        }
    }
    return DEFAULT_TYPINGS_NAMESPACE;
}

/** The `compilerOptions` of the Svelte config that svelte2tsx needs */
interface SvelteCompilerOptions {
    namespace?: unknown;
    accessors?: unknown;
    customElement?: unknown;
}

/**
 * The Svelte config of a TS project: the one next to its tsconfig, or above. Loaded once per
 * project, so changes to it need a restart of the TS server.
 */
function getSvelteCompilerOptions(
    project: ProjectInfo | undefined,
    fileName: string
): Promise<SvelteCompilerOptions> {
    if (!project) {
        return loadSvelteCompilerOptions(path.dirname(fileName));
    }
    // The inferred project has no tsconfig, use the directory of its first file
    project.svelteOptions ??= loadSvelteCompilerOptions(
        path.dirname(project.params.configFileName || fileName)
    );
    return project.svelteOptions;
}

async function loadSvelteCompilerOptions(dir: string): Promise<SvelteCompilerOptions> {
    try {
        // The Svelte options of the `vite.config` (vite-plugin-svelte or SvelteKit), else the
        // `svelte.config`, in this directory or above
        const result = await loadConfig(dir);
        if (result && 'config' in result) {
            return (result.config.compilerOptions ?? {}) as SvelteCompilerOptions;
        }
        if (result) {
            console.warn(`Error loading the Svelte config ${result.configFilePath}:`, result.error);
        }
    } catch (error) {
        console.warn(`Error loading the Svelte config for ${dir}:`, error);
    }
    return {};
}

/** Like TS6: `accessors`, else `customElement` (custom elements have accessors) */
function getAccessors(options: SvelteCompilerOptions, fileName: string): boolean | undefined {
    const accessors =
        options.accessors ??
        (typeof options.customElement === 'function'
            ? options.customElement({ filename: fileName })
            : options.customElement);
    return accessors == null ? undefined : !!accessors;
}

function getScriptExtension(
    scriptTags: ReturnType<typeof internalHelpers.extractScriptTags>
): '.ts' | '.js' {
    return isTs(scriptTags.instance?.attributes) || isTs(scriptTags.module?.attributes)
        ? '.ts'
        : '.js';
}

function isTs(attributes: Record<string, string | boolean> | undefined): boolean {
    if (!attributes) {
        return false;
    }
    const lang = attributes.lang;
    return lang === 'ts' || lang === 'typescript';
}

function offsetAt(position: Position, text: string, lineOffsets = getLineOffsets(text)): number {
    if (position.line >= lineOffsets.length) {
        return text.length;
    } else if (position.line < 0) {
        return 0;
    }

    const lineOffset = lineOffsets[position.line];
    const nextLineOffset =
        position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : text.length;

    return clamp(nextLineOffset, lineOffset, lineOffset + position.character);
}

function clamp(num: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, num));
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

type Position = { line: number; character: number };

type PositionEncoding = 'utf-8' | 'utf-16';

interface InitializeParams {
    protocolVersion: 1;
    /** The position encodings supported by TypeScript. The mapper must choose one of these encodings. */
    positionEncodings: PositionEncoding[];
    /** BCP 47 locale requested for diagnostics. */
    locale?: string;
}

interface InitializeResult {
    /** The position encoding the mapper will use for all span mapping positions and diagnostic positions. */
    positionEncoding: PositionEncoding;
    /**
     * The source identifier displayed for mapper-produced diagnostics.
     * Must not be "ts", "tsc", "typescript", or any file extension TypeScript understands.
     */
    diagnosticSource: string;
}

interface OpenProjectParams {
    /** Absolute tsconfig path, or an empty string for a project without a config file. */
    configFileName: string;
    /** Opaque process-local handle assigned by TypeScript. */
    projectHandle: string;
    /** Object from the contentMappers entry, when specified. */
    options?: Record<string, unknown>;
    /** The project's effective compiler options. */
    compilerOptions: unknown;
}

interface OpenProjectResult {
    /**
     * Stable fingerprint of all dynamically discovered configuration that can affect transforms.
     * Required, and only allowed, when the mapper declares `dynamicConfig: true`.
     */
    configIdentity?: string;
    /**
     * Absolute file names whose changes may alter configIdentity or transform output.
     * May only be returned when the package declares `dynamicConfig: true`. Do not include
     * the files being transformed; those are watched separately.
     */
    watchedFiles?: string[];
    /** Diagnostics for invalid values in this mapper's contentMappers options object. */
    optionDiagnostics?: OptionDiagnostic[];
}

interface OptionDiagnostic {
    /**
     * Property names and nonnegative array indexes relative to the mapper entry's options object.
     * An empty path reports the diagnostic on the options object itself.
     */
    path: (string | number)[];
    messageText: string;
    code?: number;
}

interface TransformParams {
    fileName: string;
    /** Original content of the file to be transformed. */
    content: string;
    /** Project handle supplied in openProject. */
    projectHandle: string;
}

interface MappedOutput {
    /** Valid JS, JSX, TS, TSX, or JSON text that TypeScript can parse. */
    text: string;
    /** The virtual file extension that determines how TypeScript parses this output. */
    extension: '.js' | '.jsx' | '.mjs' | '.cjs' | '.ts' | '.tsx' | '.mts' | '.cts' | '.json';
    /** Mappings between the original and transformed content. */
    mappings?: SpanMapping[];
    /** Framework-specific directives that suppress TypeScript diagnostics in virtual ranges. */
    diagnosticDirectives?: DiagnosticDirectives;
}

enum DiagnosticDirectivePolicy {
    Ignore = 0,
    Expect = 1
}

interface UnusedExpectDirectiveDiagnostic {
    /** Diagnostic code reported when an `Expect` directive suppresses no diagnostics. */
    code: number;
    /** Diagnostic text reported when an `Expect` directive suppresses no diagnostics. */
    messageText: string;
}

interface DiagnosticDirectives {
    /** Shared diagnostics reported for unused `Expect` directives. */
    unusedExpectDirectiveDiagnostics: UnusedExpectDirectiveDiagnostic[];
    directives: MappedDiagnosticDirective[];
}

/** Positions and lengths are in the specified `positionEncoding`. */
type MappedDiagnosticDirective = [
    /** Location of the framework directive in the original source. */
    originalStart: number,
    originalLength: number,
    /** Region of virtual code affected by the directive. */
    virtualStart: number,
    virtualEnd: number,
    policy: DiagnosticDirectivePolicy,
    /**
     * Index into `unusedExpectDirectiveDiagnostics`. Required for `Expect` directives
     * when the array contains more than one entry.
     */
    unusedExpectDirectiveIndex?: number
];

interface TransformResult extends MappedOutput {
    /** Parse errors in the original content. */
    diagnostics?: MapperDiagnostic[];
    /** Additional virtual files associated with this input. */
    supplemental?: MappedOutput[];
}

interface CloseProjectParams {
    /** Project handle supplied in openProject. */
    projectHandle: string;
}

/** Positions and lengths are in the specified `positionEncoding`. */
type SpanMapping = [
    virtualStart: number,
    virtualLength: number,
    originalStart: number,
    originalLength: number,
    kind: SpanMapKind,
    features?: SpanMapFeature
];

enum SpanMapKind {
    /** Verbatim spans in virtual text have the same length and content as their counterparts in original text. */
    Verbatim = 0,
    /** Atom spans in virtual text may have different length and content than their counterparts in the original text. */
    Atom = 1,
    /** Alias spans in virtual text may have different length and content than their counterparts in the original text, but diagnostics display their original text. */
    Alias = 2
}

/** Controls which TypeScript language service features may use a span. */
enum SpanMapFeature {
    None = 0,
    Hover = 1 << 0,
    SignatureHelp = 1 << 1,
    Completion = 1 << 2,
    Definition = 1 << 3,
    TypeDefinition = 1 << 4,
    Implementation = 1 << 5,
    References = 1 << 6,
    DocumentHighlights = 1 << 7,
    Rename = 1 << 8,
    CallHierarchy = 1 << 9,
    CodeActions = 1 << 10,
    Formatting = 1 << 11,
    InlayHints = 1 << 12,
    SemanticTokens = 1 << 13,
    FoldingRanges = 1 << 14,
    SelectionRanges = 1 << 15,
    LinkedEditing = 1 << 16,
    AutoInsert = 1 << 17,
    DocumentSymbols = 1 << 18,
    CodeLens = 1 << 19,
    /** Enables every language service feature. This is the default when `features` is omitted. */
    All = (CodeLens << 1) - 1
}

/** Start and length are in the specified `positionEncoding`. */
interface MapperDiagnostic {
    messageText: string;
    start: number;
    length: number;
    code?: number;
}
