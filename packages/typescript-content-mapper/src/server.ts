import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createTsgoFacade, internalHelpers, svelte2tsx, type TsFacade } from 'svelte2tsx/tsgo';
import { createMessageConnection } from 'vscode-jsonrpc';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';
import { loadProjectSvelteConfig, type SvelteCompilerOptions } from './svelte-config.js';
import { findTypeScript } from './typescript.js';

// stdout is the protocol channel: only the message writer gets the real stdout. Everything else
// written to it (`console.log` and `process.stdout.write` in svelte2tsx, a Svelte config or its
// plugins) goes to stderr, where TS ignores it.
const writeStdout = process.stdout.write.bind(process.stdout);
const protocolOutput = new Writable({
    write(chunk, encoding, callback) {
        writeStdout(chunk, encoding, callback);
    }
});
process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write;

function startServer() {
    const connection = createMessageConnection(
        new StreamMessageReader(process.stdin),
        new StreamMessageWriter(protocolOutput)
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

    connection.onRequest(
        'openProject',
        async (v: OpenProjectParams): Promise<OpenProjectResult> => {
            const project: Project = {
                params: v,
                contexts: new Map(),
                typingsNamespace: getTypingsNamespace(v.configFileName)
            };
            projects.set(v.projectHandle, project);
            if (!v.configFileName) {
                // The inferred project: its files can belong to different Svelte projects, the Svelte
                // config is loaded on the first transform and not watched
                return { configIdentity: 'inferred project' };
            }
            // The manifest declares `dynamicConfig`: TS asks again when one of the `watchedFiles`
            // changes, and transforms the files again if `configIdentity` changed
            const svelteConfig = await loadProjectSvelteConfig(path.dirname(v.configFileName));
            project.svelteOptions = Promise.resolve(svelteConfig.compilerOptions);
            return {
                configIdentity: `${svelteConfig.identity}\n${project.typingsNamespace}`,
                watchedFiles: svelteConfig.watchedFiles
            };
        }
    );

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
            const { compiler, isSvelte3, globalTypes, typescript } = await getOrCreate(
                project?.contexts ?? unknownProjectContexts,
                path.dirname(resolveTarget),
                () => createProjectContext(resolveTarget)
            );

            scriptTags = internalHelpers.extractScriptTags(content, {
                parse: compiler.parse,
                svelte5Plus: Number(compiler.VERSION.split('.')[0]) >= 5
            });
            extension = getScriptExtension(scriptTags);

            const svelteOptions = await getSvelteCompilerOptions(project, fileName);
            const res = await svelte2tsx(content, {
                typescript,
                filename: fileName,
                isTsFile: extension === '.ts',
                emitOnTemplateError: true,
                emitJsDoc: true,
                namespace: svelteOptions.namespace,
                typingsNamespace: project?.typingsNamespace ?? DEFAULT_TYPINGS_NAMESPACE,
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
                // Like TS6, only the parse error is reported: TypeScript's errors in the script alone
                // would be guesses (e.g. everything used only in the template is "unused")
                diagnosticDirectives:
                    length > 0
                        ? {
                              unusedExpectDirectiveDiagnostics: [],
                              directives: [
                                  [
                                      script.content.start,
                                      length,
                                      0,
                                      length,
                                      DiagnosticDirectivePolicy.Ignore
                                  ]
                              ]
                          }
                        : undefined,
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
    /** The namespace of the element typings (`svelteOptions.namespace` of the tsconfig) */
    typingsNamespace: string;
    /** The Svelte config of the project: loaded by `openProject`, or on the first transform */
    svelteOptions?: Promise<SvelteCompilerOptions>;
}

/** What a transform needs that only depends on the project. Resolved on the first transform. */
interface ProjectContext {
    /** `svelte/compiler` of the project */
    compiler: { parse: any; VERSION: string };
    isSvelte3: boolean;
    globalTypes: string[];
    /** The facade svelte2tsx parses the scripts with: TypeScript 7's */
    typescript: TsFacade;
}

const require = createRequire(import.meta.url);
const mapperDir = path.dirname(fileURLToPath(import.meta.url));
const svelte2tsxDir = path.dirname(require.resolve('svelte2tsx/package.json'));
/** Keyed by the TypeScript package directory, so projects using the same TypeScript share it */
const typescriptFacades = new Map<string, Promise<TsFacade>>();

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
    const typescript = await getTypeScriptFacade(paths);
    return { compiler, isSvelte3, globalTypes, typescript };
}

/**
 * svelte2tsx parses the scripts with the project's TypeScript 7.1+ (see `findTypeScript`), so that
 * it understands the same syntax as the TypeScript running this mapper.
 *
 * Throws if there is none; the transform then reports that as a diagnostic.
 */
function getTypeScriptFacade(paths: string[]): Promise<TsFacade> {
    const { packageDir, version } = findTypeScript(paths);
    return getOrCreate(typescriptFacades, packageDir, async () => {
        const typescript = await createTsgoFacade({ typescript: packageDir });
        console.warn(`Parsing with TypeScript ${version} (${packageDir})`);
        return typescript;
    });
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

const DEFAULT_TYPINGS_NAMESPACE = 'svelteHTML';

/**
 * `svelteOptions.namespace` of the tsconfig, e.g. `svelteNative` for Svelte Native. TS doesn't pass
 * it along (it's not a compiler option). Like TS6, only the tsconfig itself counts, not the ones it
 * extends.
 */
function getTypingsNamespace(configFileName: string): string {
    if (configFileName) {
        const config = readTsconfig(configFileName);
        const namespace = config?.svelteOptions?.namespace;
        if (typeof namespace === 'string' && namespace) {
            return namespace;
        }
    }
    return DEFAULT_TYPINGS_NAMESPACE;
}

/**
 * Reads a tsconfig (JSON with comments and trailing commas) without loading TypeScript.
 * undefined if it can't be read or parsed.
 */
function readTsconfig(configFileName: string): any {
    const text = fsSystem.readFile(configFileName);
    if (text === undefined) {
        return undefined;
    }
    try {
        return JSON.parse(stripJsonComments(text));
    } catch {
        return undefined;
    }
}

/** Removes the comments and trailing commas of JSONC, keeping the strings as they are */
function stripJsonComments(text: string): string {
    let result = '';
    let i = 0;
    while (i < text.length) {
        const char = text[i];
        if (char === '"') {
            const start = i++;
            while (i < text.length && text[i] !== '"') {
                i += text[i] === '\\' ? 2 : 1;
            }
            result += text.slice(start, ++i);
        } else if (char === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') {
                i++;
            }
        } else if (char === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            i = end === -1 ? text.length : end + 2;
        } else if (char === ',' && /^\s*[}\]]/.test(text.slice(i + 1))) {
            i++;
        } else {
            result += char;
            i++;
        }
    }
    return result;
}

/**
 * The Svelte config of a TS project: the one next to its tsconfig, or above (loaded by `openProject`).
 * The inferred project has no tsconfig, it uses the directory of its first file.
 */
function getSvelteCompilerOptions(
    project: Project | undefined,
    fileName: string
): Promise<SvelteCompilerOptions> {
    const load = (dir: string) =>
        loadProjectSvelteConfig(dir).then((config) => config.compilerOptions);
    if (!project) {
        return load(path.dirname(fileName));
    }
    project.svelteOptions ??= load(path.dirname(project.params.configFileName || fileName));
    return project.svelteOptions;
}

/**
 * Like TS6: `accessors`, else `customElement` (custom elements have accessors), which can also be a
 * function of the file name (`(options: { filename: string }) => boolean` in Svelte 5)
 */
function getAccessors(options: SvelteCompilerOptions, fileName: string): boolean | undefined {
    if (options.accessors !== undefined) {
        return options.accessors;
    }
    let customElement = options.customElement;
    if (typeof customElement === 'function') {
        try {
            customElement = customElement({ filename: fileName });
        } catch (error) {
            console.warn(
                `compilerOptions.customElement of the Svelte config threw for ${fileName}:`,
                error
            );
            return undefined;
        }
    }
    return customElement == null ? undefined : !!customElement;
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
