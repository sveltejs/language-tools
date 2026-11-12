import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    createTsgoFacade,
    internalHelpers,
    svelte2tsx as svelte2tsxTs7,
    type TsFacade
} from 'svelte2tsx/tsgo';
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

    const projects = new Map<string, Project>();
    /** For transforms of projects that weren't opened (shouldn't happen) */
    const unknownProjectContexts = new Map<string, Promise<ProjectContext>>();

    connection.onRequest('openProject', (v: OpenProjectParams): OpenProjectResult => {
        projects.set(v.projectHandle, { params: v, contexts: new Map() });
        return {};
    });

    connection.onRequest('closeProject', (v: CloseProjectParams) => {
        projects.delete(v.projectHandle);
        return {};
    });

    connection.onRequest('transform', async (v: TransformParams): Promise<TransformResult> => {
        const { fileName, content } = v;

        let scriptTags: ReturnType<typeof internalHelpers.extractScriptTags> | undefined;
        let extension: '.ts' | '.js' = '.js';

        try {
            const project = projects.get(v.projectHandle);
            // In the inferred project, configFileName is an empty string
            const resolveTarget = project?.params.configFileName || fileName;
            const { compiler, isSvelte3, globalTypes, svelte2tsx, typescript } = await getOrCreate(
                project?.contexts ?? unknownProjectContexts,
                path.dirname(resolveTarget),
                () => createProjectContext(resolveTarget)
            );

            scriptTags = internalHelpers.extractScriptTags(content, {
                parse: compiler.parse,
                svelte5Plus: Number(compiler.VERSION.split('.')[0]) >= 5
            });
            extension = getScriptExtension(scriptTags);

            const res = svelte2tsx(content, {
                typescript,
                filename: fileName,
                isTsFile: extension === '.ts',
                emitOnTemplateError: true,
                emitJsDoc: true,
                namespace: 'svelteHTML',
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

interface Project {
    params: OpenProjectParams;
    /**
     * Keyed by the directory the project's packages are resolved from: the directory of the tsconfig,
     * so there's one per configured project. The inferred project has no tsconfig, its files resolve
     * from their own directories.
     */
    contexts: Map<string, Promise<ProjectContext>>;
}

/** What a transform needs that only depends on the project. Resolved on the first transform. */
interface ProjectContext extends Transformer {
    /** `svelte/compiler` of the project */
    compiler: { parse: any; VERSION: string };
    isSvelte3: boolean;
    globalTypes: string[];
}

interface Transformer {
    svelte2tsx: typeof svelte2tsxTs7;
    /** undefined: the entry point's default */
    typescript?: TsFacade;
}

const require = createRequire(import.meta.url);
const mapperDir = path.dirname(fileURLToPath(import.meta.url));
const svelte2tsxDir = path.dirname(require.resolve('svelte2tsx'));
/**
 * Overrides which TypeScript package parses the scripts:
 * a module specifier (e.g. `@typescript/native`) or the path of a package directory
 */
const typescriptSpecifier = process.env.SVELTE_CONTENT_MAPPER_TYPESCRIPT || 'typescript';
/** Keyed by the path of the TypeScript package.json, so projects using the same TypeScript share it */
const transformers = new Map<string, Promise<Transformer>>();

async function createProjectContext(resolveTarget: string): Promise<ProjectContext> {
    const paths = [path.dirname(resolveTarget), mapperDir];
    const compilerPath = require.resolve('svelte/compiler', { paths });
    const { default: compiler } = await import(pathToFileURL(compilerPath).toString());
    const isSvelte3 = compiler.VERSION.split('.')[0] === '3';
    const globalTypes = internalHelpers.get_global_types(
        fsSystem,
        isSvelte3,
        path.dirname(require.resolve('svelte/package.json', { paths })),
        svelte2tsxDir,
        resolveTarget
    );
    const transformer = await getTransformer(paths);
    return { ...transformer, compiler, isSvelte3, globalTypes };
}

/**
 * svelte2tsx with the TypeScript the project uses: with TypeScript 7.1+, it parses the scripts
 * with that one (`svelte2tsx/tsgo`), so that it understands the same syntax as the TypeScript
 * running this mapper. Otherwise, it uses TypeScript 6 (`svelte2tsx`).
 */
function getTransformer(paths: string[]): Promise<Transformer> {
    let packageJsonPath = '';
    try {
        packageJsonPath = require.resolve(
            path.isAbsolute(typescriptSpecifier)
                ? path.join(typescriptSpecifier, 'package.json')
                : `${typescriptSpecifier}/package.json`,
            { paths }
        );
    } catch {
        // no TypeScript in the project, use svelte2tsx's
    }
    return getOrCreate(transformers, packageJsonPath, () => createTransformer(packageJsonPath));
}

/** Caches the promise, but not a failure (e.g. Svelte not installed yet): that's retried next time */
function getOrCreate<T>(
    cache: Map<string, Promise<T>>,
    key: string,
    create: () => Promise<T>
): Promise<T> {
    let promise = cache.get(key);
    if (!promise) {
        const created = create();
        cache.set(key, created);
        created.catch(() => {
            if (cache.get(key) === created) {
                cache.delete(key);
            }
        });
        promise = created;
    }
    return promise;
}

async function createTransformer(packageJsonPath: string): Promise<Transformer> {
    const version: string | undefined = packageJsonPath
        ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version
        : undefined;
    const [major, minor] = (version ?? '0.0').split('.').map(Number);
    if (major > 7 || (major === 7 && minor >= 1)) {
        try {
            const typescript = createTsgoFacade({ typescript: path.dirname(packageJsonPath) });
            console.warn(`Parsing with TypeScript ${version} (${packageJsonPath})`);
            return { svelte2tsx: svelte2tsxTs7, typescript };
        } catch (error) {
            console.warn(
                `Could not load TypeScript ${version} (${packageJsonPath}), using TypeScript 6:`,
                error
            );
        }
    }
    const { svelte2tsx } = await import('svelte2tsx');
    return { svelte2tsx };
}

/** `ts.sys` for `get_global_types`, without loading TypeScript */
const fsSystem = {
    fileExists: (file: string) => fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false,
    directoryExists: (dir: string) =>
        fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory() ?? false,
    resolvePath: (file: string) => path.resolve(file),
    readFile: (file: string) => {
        try {
            return fs.readFileSync(file, 'utf-8');
        } catch {
            return undefined;
        }
    },
    writeFile: (file: string, data: string) => fs.writeFileSync(file, data)
};

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
