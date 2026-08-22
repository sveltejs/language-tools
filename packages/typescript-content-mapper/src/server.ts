import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { svelte2tsx, internalHelpers } from 'svelte2tsx';
import ts from 'typescript';
import { createMessageConnection } from 'vscode-jsonrpc';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';

// Override console.log and console.error to prevent logging to stdout/stderr
// This is important because the client/server communicates with the client via stdout/stderr, and logging to stdout/stderr would interfere with this communication
console.log = () => {};
console.error = () => {};

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

    const projectMap = new Map<string, OpenProjectParams>();

    connection.onRequest('openProject', (v: OpenProjectParams): OpenProjectResult => {
        projectMap.set(v.projectHandle, v);
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

        const isTsFile = /<script\s+[^>]*?lang=('|")(ts|typescript)('|")/.test(content);
        try {
            const projectInfo = projectMap.get(v.projectHandle);
            const resolveTarget = projectInfo?.configFileName ?? fileName;
            const resolveConfig = {
                paths: [path.dirname(resolveTarget), path.dirname(fileURLToPath(import.meta.url))]
            };
            const compilerPath = require.resolve('svelte/compiler', resolveConfig);
            const { default: compiler } = await import(pathToFileURL(compilerPath).toString());

            let globalTypes = globalTypesCache.get(resolveTarget);
            if (!globalTypes) {
                globalTypes = internalHelpers.get_global_types(
                    ts.sys,
                    compiler.VERSION.split('.')[0] === '3',
                    path.dirname(require.resolve('svelte/package.json', resolveConfig)),
                    path.dirname(require.resolve('svelte2tsx')),
                    resolveTarget
                );
                globalTypesCache.set(resolveTarget, globalTypes);
            }
            const res = svelte2tsx(content, {
                filename: fileName,
                isTsFile: isTsFile,
                emitOnTemplateError: true,
                emitJsDoc: true,
                namespace: 'svelteHTML',
                parse: compiler.parse,
                version: compiler.VERSION,
                shimPaths: globalTypes,
                generateSpanMapping: true
            });

            return {
                text: res.code,
                extension: isTsFile ? '.ts' : '.js',
                mappings: res.spanMappings ?? [],
                diagnostics: []
            };
        } catch (error) {
            return {
                text: '',
                extension: isTsFile ? '.ts' : '.js',
                mappings: [],
                diagnostics: [
                    {
                        messageText: (error as Error).message,
                        // TODO
                        start: 0,
                        length: 0
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
