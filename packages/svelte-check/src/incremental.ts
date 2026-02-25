import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { svelte2tsx, internalHelpers, InternalHelpers } from 'svelte2tsx';
import { parse, VERSION as svelteVersion, VERSION } from 'svelte/compiler';
import ts from 'typescript';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver-protocol';
import {
    mapSvelteCheckDiagnostics,
    offsetAt,
    positionAt,
    getLineOffsets
} from 'svelte-language-server';
import { pathToFileURL } from 'url';
import { findFiles } from './utils';

type ManifestEntry = {
    sourcePath: string;
    outPath: string;
    mtimeMs: number;
    size: number;
    // Svelte file specific fields
    dtsPath?: string;
    isTsFile?: boolean;
    compilerWarnings?: Diagnostic[];
    cssDiagnostics?: Diagnostic[];
    // Kit file specific fields
    isKitFile?: boolean;
    addedCode?: InternalHelpers.AddedCode[];
};

type Manifest = {
    version: number;
    entries: Record<string, ManifestEntry>;
};

export type EmitResult = {
    cacheDir: string;
    emitDir: string;
    manifestPath: string;
    entries: ManifestEntry[];
    changedFiles: string[];
    workspacePath: string;
    manifest: Manifest;
};

export type ParsedDiagnostic = {
    filePath: string;
    line: number;
    character: number;
    /** Span length in characters, parsed from tsc pretty-output ~~ underlines */
    length: number;
    severity: DiagnosticSeverity;
    code: number;
    message: string;
};

const MANIFEST_VERSION = 2;
const SVELTE_KIT_DIR = '.svelte-kit';
const CACHE_DIR_NAME = '.svelte-check';
const EMIT_SUBDIR = 'svelte';

/**
 * Determines the cache directory location for svelte-check output.
 * Uses `.svelte-kit/.svelte-check` if a SvelteKit project is detected,
 * otherwise falls back to `.svelte-check` in the workspace root.
 */
function getCacheDir(workspacePath: string): string {
    const svelteKitDir = path.join(workspacePath, SVELTE_KIT_DIR);
    if (fs.existsSync(svelteKitDir) && fs.statSync(svelteKitDir).isDirectory()) {
        return path.join(svelteKitDir, CACHE_DIR_NAME);
    }
    return path.join(workspacePath, CACHE_DIR_NAME);
}

function toPosixPath(value: string) {
    return value.replace(/\\/g, '/');
}

function toRelativePosix(baseDir: string, targetPath: string) {
    const relative = path.relative(baseDir, targetPath);
    return toPosixPath(relative || '.');
}

/**
 * Default SvelteKit file paths used when svelte.config.js doesn't specify custom paths.
 */
const defaultKitFilesSettings: InternalHelpers.KitFilesSettings = {
    paramsPath: 'src/params',
    serverHooksPath: 'src/hooks.server',
    clientHooksPath: 'src/hooks.client',
    universalHooksPath: 'src/hooks'
};

/**
 * This function encapsulates the import call in a way
 * that TypeScript does not transpile `import()`.
 * https://github.com/microsoft/TypeScript/issues/43329
 */
const dynamicImport = new Function('modulePath', 'return import(modulePath)') as (
    modulePath: URL
) => Promise<any>;

/**
 * Loads the svelte.config.js file and extracts SvelteKit file path settings.
 * Falls back to default paths if config doesn't exist or doesn't specify custom paths.
 *
 * @param workspacePath - Root directory of the project
 * @returns KitFilesSettings with paths for params, hooks files
 */
async function loadKitFilesSettings(
    workspacePath: string
): Promise<InternalHelpers.KitFilesSettings> {
    const configExtensions = ['js', 'cjs', 'mjs'];
    let configPath: string | undefined;

    for (const ext of configExtensions) {
        const tryPath = path.join(workspacePath, `svelte.config.${ext}`);
        if (fs.existsSync(tryPath)) {
            configPath = tryPath;
            break;
        }
    }

    if (!configPath) {
        return defaultKitFilesSettings;
    }

    try {
        const config = (await dynamicImport(pathToFileURL(configPath)))?.default;
        if (!config?.kit?.files) {
            return defaultKitFilesSettings;
        }

        const files = config.kit.files;
        return {
            paramsPath: files.params ?? defaultKitFilesSettings.paramsPath,
            serverHooksPath: files.hooks?.server ?? defaultKitFilesSettings.serverHooksPath,
            clientHooksPath: files.hooks?.client ?? defaultKitFilesSettings.clientHooksPath,
            universalHooksPath: files.hooks?.universal ?? defaultKitFilesSettings.universalHooksPath
        };
    } catch {
        return defaultKitFilesSettings;
    }
}

/**
 * Transforms Svelte files into TypeScript/JavaScript using svelte2tsx and writes them to a cache directory.
 * Supports incremental builds by tracking file modification times and sizes in a manifest.
 *
 * @param workspacePath - Root directory of the project
 * @param filePathsToIgnore - Glob patterns for files to exclude from processing
 * @param incremental - When true, only reprocesses files that have changed since the last run
 * @returns Paths to cache/emit directories, manifest, processed entries, and list of changed files
 */
export async function emitSvelteFiles(
    workspacePath: string,
    filePathsToIgnore: string[],
    incremental: boolean
): Promise<EmitResult> {
    const cacheDir = getCacheDir(workspacePath);
    const emitDir = path.join(cacheDir, EMIT_SUBDIR);
    const manifestPath = path.join(cacheDir, 'manifest.json');
    fs.mkdirSync(emitDir, { recursive: true });

    const manifest = incremental
        ? loadManifest(manifestPath, workspacePath)
        : { version: MANIFEST_VERSION, entries: {} as Record<string, ManifestEntry> };
    const kitFilesSettings = await loadKitFilesSettings(workspacePath);
    const isJsOrTsFile = (filePath: string) => filePath.endsWith('.ts') || filePath.endsWith('.js');
    const allRelevantFiles = await findFiles(
        workspacePath,
        filePathsToIgnore,
        (filePath) =>
            filePath.endsWith('.svelte') ||
            (isJsOrTsFile(filePath) && internalHelpers.isKitFile(filePath, kitFilesSettings))
    );
    const svelteFiles: string[] = [];
    const kitFiles: string[] = [];
    for (const filePath of allRelevantFiles) {
        if (filePath.endsWith('.svelte')) {
            svelteFiles.push(filePath);
        } else {
            kitFiles.push(filePath);
        }
    }
    const currentSet = new Set(svelteFiles);
    const changedFiles: string[] = [];

    // Remove deleted files (only relevant for incremental builds with a persisted manifest)
    if (incremental) {
        pruneDeletedManifestEntries(manifest, currentSet, (entry) => !entry.isKitFile);
    }

    for (const sourcePath of svelteFiles) {
        const stats = fs.statSync(sourcePath);
        const entry = manifest.entries[sourcePath];

        // When file stats match the cached entry, avoid reading the file just to determine isTsFile
        // (only for Svelte entries, not Kit entries which don't have isTsFile)
        const statsUnchanged =
            !!entry &&
            !entry.isKitFile &&
            entry.mtimeMs === stats.mtimeMs &&
            entry.size === stats.size;
        let text: string | undefined;
        let isTsFile: boolean;

        if (statsUnchanged && entry.isTsFile !== undefined) {
            isTsFile = entry.isTsFile;
        } else {
            text = fs.readFileSync(sourcePath, 'utf-8');
            isTsFile = isTsSvelte(text);
        }

        const { outPath, dtsPath } = getOutputPaths(workspacePath, emitDir, sourcePath, isTsFile);

        const outPathChanged = !!entry && entry.outPath !== outPath;
        if (outPathChanged) {
            deleteEntry(entry);
        }

        const hasChanged =
            !incremental ||
            !entry ||
            entry.isKitFile || // Force reprocess if it was previously a Kit entry
            outPathChanged ||
            !statsUnchanged ||
            !fs.existsSync(entry.outPath) ||
            (entry.dtsPath && !fs.existsSync(entry.dtsPath));

        if (!hasChanged) {
            continue;
        }
        changedFiles.push(sourcePath);

        if (!text) {
            text = fs.readFileSync(sourcePath, 'utf-8');
        }

        fs.mkdirSync(path.dirname(outPath), { recursive: true });

        try {
            const tsx = svelte2tsx(text, {
                parse,
                version: svelteVersion,
                filename: sourcePath,
                isTsFile,
                mode: 'ts',
                emitOnTemplateError: false,
                emitJsDoc: true, // without this, tsc/tsgo will choke on the syntactic errors and not emit semantic errors
                rewriteExternalImports: {
                    workspacePath,
                    generatedPath: outPath
                }
            });

            fs.writeFileSync(outPath, tsx.code, 'utf-8');

            const dtsImportPath = `./${path.basename(outPath)}`;
            const dtsContent = `export { default } from "${dtsImportPath}";\nexport * from "${dtsImportPath}";\n`;
            fs.writeFileSync(dtsPath, dtsContent, 'utf-8');

            manifest.entries[sourcePath] = {
                sourcePath,
                outPath,
                dtsPath,
                mtimeMs: stats.mtimeMs,
                size: stats.size,
                isTsFile
            };
        } catch (e) {
            // rely on the Svelte compiler to emit errors (when running the Svelte diagnostics)
            safeUnlink(outPath);
            safeUnlink(dtsPath);
            delete manifest.entries[sourcePath];
        }
    }

    // Process SvelteKit files (route files, hooks, params)
    const currentKitSet = new Set(kitFiles);

    // Remove deleted Kit files
    if (incremental) {
        pruneDeletedManifestEntries(manifest, currentKitSet, (entry) => !!entry.isKitFile);
    }

    for (const sourcePath of kitFiles) {
        const stats = fs.statSync(sourcePath);
        const entry = manifest.entries[sourcePath];

        const statsUnchanged =
            !!entry && entry.mtimeMs === stats.mtimeMs && entry.size === stats.size;

        const outPath = getKitOutputPath(workspacePath, emitDir, sourcePath);

        const outPathChanged = !!entry && entry.outPath !== outPath;
        if (outPathChanged) {
            deleteEntry(entry);
        }

        const hasChanged =
            !incremental || !entry || outPathChanged || !statsUnchanged || !fs.existsSync(outPath);

        if (!hasChanged) {
            continue;
        }
        changedFiles.push(sourcePath);

        const text = fs.readFileSync(sourcePath, 'utf-8');
        const isTsFile = sourcePath.endsWith('.ts');

        const result = internalHelpers.upsertKitFile(
            ts,
            sourcePath,
            kitFilesSettings,
            () =>
                ts.createSourceFile(
                    sourcePath,
                    text,
                    ts.ScriptTarget.Latest,
                    true,
                    isTsFile ? ts.ScriptKind.TS : ts.ScriptKind.JS
                ),
            undefined,
            {
                workspacePath,
                generatedPath: outPath
            }
        );

        if (!result) {
            // Not a Kit file or no transformations needed, skip
            continue;
        }

        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, result.text, 'utf-8');

        manifest.entries[sourcePath] = {
            sourcePath,
            outPath,
            mtimeMs: stats.mtimeMs,
            size: stats.size,
            isKitFile: true,
            addedCode: result.addedCode
        };
    }

    if (incremental) {
        writeManifest(manifestPath, manifest, workspacePath);
    }

    return {
        cacheDir,
        emitDir,
        manifestPath,
        entries: Object.values(manifest.entries),
        changedFiles,
        workspacePath,
        manifest
    };
}

/**
 * Creates an overlay tsconfig.json that extends the project's tsconfig with additional
 * configuration needed for type-checking Svelte files. This includes:
 * - Adding the emit directory to `rootDirs` so TypeScript can resolve our virtual Svelte modules
 * - Rebasing include/exclude patterns to work from the cache directory
 * - Including svelte2tsx shim files for proper type definitions
 * - Configuring incremental build settings when enabled
 *
 * @param tsconfigPath - Path to the project's original tsconfig.json
 * @param emitResult - Result from emitSvelteFiles containing cache directory paths
 * @param incremental - Whether to enable TypeScript incremental compilation
 * @param useTsgo - Whether to configure for tsgo
 * @returns Path to the generated overlay tsconfig.json
 */
export function writeOverlayTsconfig(
    tsconfigPath: string,
    emitResult: EmitResult,
    incremental: boolean,
    useTsgo: boolean
): string {
    const cacheDir = emitResult.cacheDir;
    const overlayPath = path.join(cacheDir, 'tsconfig.json');
    const tsBuildInfoFile = path.join(cacheDir, 'tsbuildinfo.json');
    const overlayDir = path.dirname(overlayPath);

    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
        throw new Error(
            ts.formatDiagnosticsWithColorAndContext([configFile.error], {
                getCanonicalFileName: (fileName) => fileName,
                getCurrentDirectory: ts.sys.getCurrentDirectory,
                getNewLine: () => ts.sys.newLine
            })
        );
    }
    const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsconfigPath)
    );
    const baseRootDirs = parsed.options.rootDirs ??
        configFile.config?.compilerOptions?.rootDirs ?? ['.'];
    const baseRootDirsAbs = baseRootDirs.map((dir: string) =>
        path.resolve(path.join(path.dirname(tsconfigPath)), dir)
    );
    const rootDirs = Array.from(new Set([...baseRootDirsAbs, path.join(cacheDir, 'svelte')])).map(
        (dir) => toRelativePosix(overlayDir, dir)
    );
    const tsconfigDir = path.dirname(tsconfigPath);
    const rawInclude = normalizeConfigSpecs(parsed.raw?.include);
    const rawExclude = normalizeConfigSpecs(parsed.raw?.exclude);
    const rawFiles = normalizeConfigSpecs(parsed.raw?.files) ?? [];
    const include = rebaseConfigSpecs(rawInclude, tsconfigDir, overlayDir);
    const exclude = rebaseConfigSpecs(rawExclude, tsconfigDir, overlayDir);
    // Turn files/include/exclude specs that match .svelte files into corresponding includes for our virtual files.
    // We do this here instead of filtering on includes/excludes before deciding which Svelte files to
    // virtualize because includes/excludes could only do starting points and module resolution could
    // find other .svelte files which need to be included, too.
    let configFiles = rebaseConfigSpecs(rawFiles, tsconfigDir, overlayDir) ?? [];
    // Remove .svelte files from the files list to avoid TS6054; replace with .svelte.d.ts.
    configFiles = configFiles.filter((file) => !file.endsWith('.svelte'));
    configFiles = configFiles.concat(rawFiles.map((file) => toVirtualSvelteDtsSpec(file)));
    const virtualInclude = rawInclude?.map((spec) => toVirtualSvelteDtsSpec(spec));
    const mergedInclude = [...(include ?? []), ...(virtualInclude ?? [])];
    const virtualExclude = rawExclude?.map((spec) => toVirtualSvelteDtsSpec(spec));
    const upsertedExcludes = emitResult.entries.map((e) =>
        toRelativePosix(overlayDir, e.sourcePath)
    );
    const mergedExclude = Array.from(
        new Set([...(exclude ?? []), ...(virtualExclude ?? []), ...upsertedExcludes])
    );
    const shimFiles = resolveSvelte2tsxShims().map((fileName) =>
        toRelativePosix(overlayDir, fileName)
    );
    const rebasedReferences = parsed.raw?.references?.map((ref: any) => ({
        ...ref,
        path: toRelativePosix(overlayDir, path.resolve(tsconfigDir, ref.path))
    }));

    const rebasedPaths = rebasePathsConfig(parsed.options, tsconfigDir, overlayDir, useTsgo);

    const overlay = {
        extends: toRelativePosix(overlayDir, tsconfigPath),
        compilerOptions: {
            rootDirs,
            allowArbitraryExtensions: true,
            noEmit: true,
            incremental,
            tsBuildInfoFile: toRelativePosix(overlayDir, tsBuildInfoFile),
            ...(rebasedPaths && Object.keys(rebasedPaths).length ? { paths: rebasedPaths } : {})
        },
        files: Array.from(new Set([...(configFiles ?? []), ...shimFiles])),
        ...(mergedInclude.length ? { include: mergedInclude } : {}),
        ...(mergedExclude.length ? { exclude: mergedExclude } : {}),
        ...(rebasedReferences ? { references: rebasedReferences } : {})
    };

    fs.writeFileSync(overlayPath, JSON.stringify(overlay, null, 2), 'utf-8');
    return overlayPath;
}

/**
 * Spawns a TypeScript compiler process (tsc or tsgo) to perform type-checking
 * and collects the diagnostics from its output.
 *
 * @param tsconfigPath - Path to the tsconfig.json to use for compilation
 * @param useTsgo - When true, uses the experimental native TypeScript compiler (tsgo)
 * @param incremental - Whether to enable incremental compilation for faster subsequent runs
 * @param cwd - Working directory for the TypeScript compiler process
 * @returns Parsed diagnostics containing file paths, positions, severity, and messages
 */
export function runTypeScriptDiagnostics(
    tsconfigPath: string,
    useTsgo: boolean,
    incremental: boolean,
    cwd: string
): Promise<ParsedDiagnostic[]> {
    const args = [
        useTsgo
            ? path.join(
                  path.dirname(require.resolve('@typescript/native-preview/package.json')),
                  'bin/tsgo.js'
              )
            : require.resolve('typescript/bin/tsc'),
        '-p',
        tsconfigPath,
        '--pretty',
        'true',
        '--noErrorTruncation'
    ];

    if (incremental) {
        args.push('--incremental');
        args.push(
            '--tsBuildInfoFile',
            toPosixPath(path.join(path.dirname(tsconfigPath), 'tsbuildinfo.json'))
        );
    }

    return new Promise<ParsedDiagnostic[]>((resolve, reject) => {
        const proc = spawn('node', args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env
        });
        let stdout = '';
        let stderr = '';

        proc.stdout.setEncoding('utf-8');
        proc.stderr.setEncoding('utf-8');

        proc.stdout.on('data', (data: string) => {
            stdout += data;
        });

        proc.stderr.on('data', (data: string) => {
            stderr += data;
        });

        proc.on('error', (err: Error) => {
            reject(err);
        });

        proc.on('close', () => {
            const output = `${stdout}\n${stderr}`;
            try {
                resolve(parseDiagnostics(output, cwd));
            } catch (e) {
                reject(e);
            }
        });
    });
}

/**
 * Maps TypeScript CLI diagnostics back to their original Svelte source files.
 * For Svelte files, uses source maps to translate positions from the generated
 * TypeScript/JavaScript back to the original Svelte markup.
 * For non-Svelte files (TS/JS), passes diagnostics through with minimal transformation.
 *
 * @param diagnostics - Raw diagnostics parsed from TypeScript compiler output
 * @param emitResult - Emit result containing the mapping between source and generated files
 * @returns Diagnostics grouped by file with positions mapped to original sources
 */
export function mapCliDiagnosticsToLsp(
    diagnostics: ParsedDiagnostic[],
    emitResult: EmitResult
): Array<{ filePath: string; text: string; diagnostics: Diagnostic[] }> {
    const entryByOutPath = new Map(
        emitResult.entries.map((entry) => [path.normalize(entry.outPath), entry])
    );
    const excludedSourcePaths = new Set(
        emitResult.entries
            .map((e) => e.isKitFile && e.addedCode?.length && path.normalize(e.sourcePath))
            .filter((p): p is string => !!p)
    );

    const diagnosticsByFile = new Map<string, ParsedDiagnostic[]>();
    for (const diagnostic of diagnostics) {
        const key = path.normalize(diagnostic.filePath);
        // Even though we try to exclude +page.js etc files that had code inserted (due to SvelteKit's zero types feature)
        // we might still have them included through code in .svelte-kit/types importing them. So we exclude the diagnostics for these.
        if (excludedSourcePaths.has(key)) {
            continue;
        }

        const existing = diagnosticsByFile.get(key);
        if (existing) {
            existing.push(diagnostic);
        } else {
            diagnosticsByFile.set(key, [diagnostic]);
        }
    }

    const results = new Map<
        string,
        { filePath: string; text: string; diagnostics: Diagnostic[] }
    >();

    for (const [filePath, fileDiagnostics] of diagnosticsByFile.entries()) {
        const entry = entryByOutPath.get(filePath);
        if (entry) {
            const sourceText = fs.readFileSync(entry.sourcePath, 'utf-8');

            if (entry.isKitFile && entry.addedCode) {
                // Kit file: use addedCode for position mapping
                const source = isTypescriptFile(entry.sourcePath) ? 'ts' : 'js';
                const generatedText = fs.readFileSync(entry.outPath, 'utf-8');
                const sourceLineOffsets = getLineOffsets(sourceText);
                const generatedLineOffsets = getLineOffsets(generatedText);
                const mappedDiagnostics = fileDiagnostics.map((diag) => {
                    const generatedOffset = offsetAt(
                        { line: diag.line, character: diag.character },
                        generatedText,
                        generatedLineOffsets
                    );
                    const { pos: startOffset } = internalHelpers.toOriginalPos(
                        generatedOffset,
                        entry.addedCode!
                    );
                    const { pos: endOffset } = internalHelpers.toOriginalPos(
                        generatedOffset + diag.length,
                        entry.addedCode!
                    );
                    const startPos = positionAt(startOffset, sourceText, sourceLineOffsets);
                    const endPos = positionAt(endOffset, sourceText, sourceLineOffsets);
                    return {
                        range: Range.create(startPos, endPos),
                        severity: diag.severity,
                        code: diag.code,
                        message: diag.message,
                        source
                    };
                });

                results.set(entry.sourcePath, {
                    filePath: entry.sourcePath,
                    text: sourceText,
                    diagnostics: mappedDiagnostics
                });
            } else {
                // Svelte file: use source maps for position mapping
                const generatedText = fs.readFileSync(entry.outPath, 'utf-8');
                const tsDiagnostics = fileDiagnostics.map((diag) =>
                    cliDiagnosticToTsDiagnostic(
                        diag,
                        entry.outPath,
                        generatedText,
                        entry.isTsFile ?? false
                    )
                );
                const mappedDiagnostics = mapSvelteCheckDiagnostics(
                    entry.sourcePath,
                    sourceText,
                    tsDiagnostics,
                    {
                        rewriteExternalImports: {
                            workspacePath: emitResult.workspacePath,
                            generatedPath: entry.outPath
                        }
                    }
                );

                results.set(entry.sourcePath, {
                    filePath: entry.sourcePath,
                    text: sourceText,
                    diagnostics: mappedDiagnostics
                });
            }
        } else {
            const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
            const source = isTypescriptFile(filePath) ? 'ts' : 'js';
            const mappedDiagnostics = fileDiagnostics.map((diag) => ({
                range: Range.create(
                    { line: diag.line, character: diag.character },
                    { line: diag.line, character: diag.character + diag.length }
                ),
                severity: diag.severity,
                code: diag.code,
                message: diag.message,
                source
            }));

            results.set(filePath, {
                filePath,
                text,
                diagnostics: mappedDiagnostics
            });
        }
    }

    return Array.from(results.values());
}

/** Strips ANSI escape codes from a string */
function stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Parses TypeScript pretty-printed compiler output into structured diagnostic objects.
 *
 * With `--pretty true`, tsc outputs diagnostics in this format (after ANSI stripping):
 *
 *     file.ts:5:10 - error TS2322: Type 'string' is not assignable to type 'number'.
 *
 *     5     let count: number = 'oops';
 *                               ~~~~~~
 *
 * We parse the header line for file/line/col/severity/code/message, then look ahead
 * for a `~~~~~~` underline line to determine the exact error span length.
 *
 * @param output - Raw stdout/stderr output from the TypeScript compiler
 * @param baseDir - Base directory for resolving relative file paths
 * @returns Array of parsed diagnostics with absolute file paths and 0-based positions
 */
function parseDiagnostics(output: string, baseDir: string): ParsedDiagnostic[] {
    const clean = stripAnsi(output);
    const diagnostics: ParsedDiagnostic[] = [];
    const lines = clean.split(/\r?\n/);
    // Pretty format: file.ts:5:10 - error TS2322: message
    const headerRegex = /^(.+):(\d+):(\d+) - (error|warning) TS(\d+): (.*)$/;
    // Tilde underline: optional leading whitespace followed by one or more tildes
    const tildeRegex = /^(\s*)(~+)\s*$/;

    for (let i = 0; i < lines.length; i++) {
        const match = headerRegex.exec(lines[i].trim());
        if (!match) {
            continue;
        }
        const [, filePath, lineStr, colStr, severity, codeStr, message] = match;
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
        const lineNum = Math.max(0, Number(lineStr) - 1);
        const colNum = Math.max(0, Number(colStr) - 1);

        // Look ahead (up to 4 lines) for a ~~ underline to determine span length.
        // The underline appears after the source context line in pretty output.
        let length = 1;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const tildeMatch = tildeRegex.exec(lines[j]);
            if (tildeMatch) {
                length = tildeMatch[2].length;
                break;
            }
            // Stop looking if we hit another diagnostic header
            if (headerRegex.test(lines[j].trim())) {
                break;
            }
        }

        diagnostics.push({
            filePath: resolvedPath,
            line: lineNum,
            character: colNum,
            length,
            severity:
                severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
            code: Number(codeStr),
            message
        });
    }

    return diagnostics;
}

/**
 * Checks if a Svelte file contains a TypeScript script block (lang="ts" or lang="typescript").
 */
function isTsSvelte(text: string): boolean {
    return /<script[^>]*\blang\s*=\s*["'](ts|typescript)["'][^>]*>/i.test(text);
}

function isTypescriptFile(filePath: string): boolean {
    return /\.(ts|tsx|mts|cts)$/.test(filePath);
}

/**
 * Converts a CLI-parsed diagnostic into a TypeScript Diagnostic object.
 * Creates a source file from the generated text to calculate precise byte positions.
 * Uses the span length parsed from tsc's ~~ underline output.
 *
 * @param diag - Parsed diagnostic from CLI output (includes span length from ~~ underlines)
 * @param filePath - Path to the generated TypeScript/JavaScript file
 * @param generatedText - Content of the generated file for position calculation
 * @param isTsFile - Whether the source Svelte file uses TypeScript
 * @returns TypeScript Diagnostic object suitable for further processing
 */
function cliDiagnosticToTsDiagnostic(
    diag: ParsedDiagnostic,
    filePath: string,
    generatedText: string,
    isTsFile: boolean
): ts.Diagnostic {
    const sourceFile = ts.createSourceFile(
        filePath,
        generatedText,
        ts.ScriptTarget.Latest,
        true,
        isTsFile ? ts.ScriptKind.TS : ts.ScriptKind.JS
    );
    const start = sourceFile.getPositionOfLineAndCharacter(diag.line, diag.character);

    return {
        file: sourceFile,
        start,
        length: diag.length,
        category:
            diag.severity === DiagnosticSeverity.Warning
                ? ts.DiagnosticCategory.Warning
                : ts.DiagnosticCategory.Error,
        code: diag.code,
        messageText: diag.message,
        source: 'ts'
    };
}

/**
 * Computes the output file paths for a Svelte source file.
 * The result is a file path for for the actual generated code (prefixed with `++`
 * to prevent conflicts with other files) and a file path for the declaration file
 * which is the same as the original file but with a `.d.ts` extension.
 * We do this so that TypeScript can resolve imports to '.svelte' files even with module resolution
 * set to 'node16' or 'nodenext'.
 *
 * @param workspacePath - Root directory of the project
 * @param emitDir - Directory where generated files are written
 * @param sourcePath - Path to the source Svelte file
 * @param isTsFile - Whether the Svelte file uses TypeScript (affects extension)
 * @returns Paths for the generated code file (.ts/.js) and declaration file (.d.ts)
 */
function getOutputPaths(
    workspacePath: string,
    emitDir: string,
    sourcePath: string,
    isTsFile: boolean
): { outPath: string; dtsPath: string } {
    const relPath = path.relative(workspacePath, sourcePath);
    const base = relPath.replace(/\.svelte$/, `.svelte.${isTsFile ? 'ts' : 'js'}`);
    const baseOutputPath = path.join(emitDir, base);
    const outPath = path.join(path.dirname(baseOutputPath), `++${path.basename(baseOutputPath)}`);
    const dtsPath = baseOutputPath.replace(/\.svelte\.(ts|js)$/, '.svelte.d.ts');
    return {
        outPath: outPath.replace(/\\/g, '/'),
        dtsPath: dtsPath.replace(/\\/g, '/')
    };
}

/**
 * Computes the output file path for a SvelteKit route/hook/params file.
 * Unlike Svelte files, Kit files keep their original filename (no ++ prefix needed).
 *
 * @param workspacePath - Root directory of the project
 * @param emitDir - Directory where generated files are written
 * @param sourcePath - Path to the source Kit file
 * @returns Path for the generated code file
 */
function getKitOutputPath(workspacePath: string, emitDir: string, sourcePath: string): string {
    const relPath = path.relative(workspacePath, sourcePath);
    return toPosixPath(path.join(emitDir, relPath));
}

/**
 * Rebases an array of tsconfig path specifications from one directory to another.
 * Used when creating the overlay tsconfig to make relative paths work correctly.
 */
function rebaseConfigSpecs(specs: unknown, fromDir: string, toDir: string): string[] | undefined {
    if (!Array.isArray(specs)) {
        return undefined;
    }
    return specs.map((spec) => rebaseConfigSpec(String(spec), fromDir, toDir));
}

/**
 * Rebases a single tsconfig path specification from one directory to another.
 *
 * @param spec - The path specification to rebase (e.g., "./src", "${configDir}/lib")
 * @param fromDir - The directory the spec is currently relative to
 * @param toDir - The directory the spec should be relative to after rebasing
 * @returns The rebased path in POSIX format
 */
function rebaseConfigSpec(spec: string, fromDir: string, toDir: string): string {
    const configDirPattern = /^\$\{configDir\}/i; // {configDir} is a special placeholder for the project root directory
    const resolved = configDirPattern.test(spec)
        ? path.resolve(fromDir, spec.replace(configDirPattern, '.'))
        : path.isAbsolute(spec)
          ? spec
          : path.resolve(fromDir, spec);
    return toRelativePosix(toDir, resolved);
}

/**
 * Normalizes tsconfig include/exclude/files specifications to a string array.
 * Handles undefined, null, single values, and arrays uniformly.
 */
function normalizeConfigSpecs(specs: unknown): string[] | undefined {
    if (specs === undefined || specs === null) {
        return undefined;
    }
    if (Array.isArray(specs)) {
        return specs.map((spec) => String(spec));
    }
    return [String(specs)];
}

function rebasePathsConfig(
    options: ts.CompilerOptions,
    tsconfigDir: string,
    overlayDir: string,
    useTsgo: boolean
): Record<string, string[]> | undefined {
    if (!options.paths) {
        return undefined;
    }

    const rebased: Record<string, string[]> = {};
    const pathsBaseDir =
        !useTsgo && options.baseUrl ? path.resolve(tsconfigDir, options.baseUrl) : tsconfigDir;

    for (const [key, specs] of Object.entries(options.paths)) {
        const result: string[] = [];
        for (const spec of specs) {
            // ${configDir} placeholder should already be resolved here
            const absoluteSpec = path.isAbsolute(spec) ? spec : path.resolve(pathsBaseDir, spec);
            const rebasedSpec = toRelativePosix(overlayDir, absoluteSpec);
            result.push(rebasedSpec);
            let posixSpec = toPosixPath(spec);
            if (path.isAbsolute(posixSpec)) {
                const relativeToTsconfig = path.relative(pathsBaseDir, posixSpec);
                posixSpec = './' + toPosixPath(relativeToTsconfig);
            }
            if (posixSpec.startsWith('./')) {
                result.push('./' + EMIT_SUBDIR + '/' + posixSpec.slice(2));
            }
        }
        rebased[key] = result;
    }
    return rebased;
}

function toVirtualSvelteDtsSpec(spec: string): string {
    const normalized = spec.replace(/^\$\{configDir\}/i, '.').replace(/\.svelte$/, '.svelte.d.ts');
    return `${EMIT_SUBDIR}/${normalized}`;
}

function deleteEntry(entry: ManifestEntry) {
    safeUnlink(entry.outPath);
    if (entry.dtsPath) safeUnlink(entry.dtsPath);
}

function pruneDeletedManifestEntries(
    manifest: Manifest,
    currentSet: Set<string>,
    shouldConsiderEntry: (entry: ManifestEntry) => boolean
) {
    for (const [sourcePath, entry] of Object.entries(manifest.entries)) {
        if (shouldConsiderEntry(entry) && !currentSet.has(sourcePath)) {
            deleteEntry(entry);
            delete manifest.entries[sourcePath];
        }
    }
}

function safeUnlink(filePath: string) {
    try {
        fs.unlinkSync(filePath);
    } catch {
        // ignore
    }
}

/**
 * Loads the incremental build manifest from disk.
 * The manifest tracks which files have been processed and their metadata
 * to enable incremental rebuilds. Returns an empty manifest if the file
 * doesn't exist, is corrupt, or has an incompatible version.
 * Converts relative paths stored in the manifest to absolute paths for processing.
 *
 * @param manifestPath - Path to the manifest.json file
 * @param workspacePath - Workspace root for resolving relative paths
 * @returns The loaded manifest with absolute paths, or a fresh empty manifest
 */
function loadManifest(manifestPath: string, workspacePath: string): Manifest {
    if (!fs.existsSync(manifestPath)) {
        return { version: MANIFEST_VERSION, entries: {} };
    }
    try {
        const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;
        if (data.version !== MANIFEST_VERSION) {
            return { version: MANIFEST_VERSION, entries: {} };
        }
        // Resolve relative paths to absolute
        const resolvedEntries: Record<string, ManifestEntry> = {};
        for (const [relKey, entry] of Object.entries(data.entries)) {
            const absKey = toPosixPath(path.resolve(workspacePath, relKey));
            resolvedEntries[absKey] = {
                ...entry,
                sourcePath: toPosixPath(path.resolve(workspacePath, entry.sourcePath)),
                outPath: toPosixPath(path.resolve(workspacePath, entry.outPath)),
                dtsPath: entry.dtsPath
                    ? toPosixPath(path.resolve(workspacePath, entry.dtsPath))
                    : undefined
            };
        }
        return { version: data.version, entries: resolvedEntries };
    } catch {
        return { version: MANIFEST_VERSION, entries: {} };
    }
}

/**
 * Persists the incremental build manifest to disk.
 * Converts all absolute paths to relative paths before writing to ensure
 * the manifest remains portable across different machines/environments.
 *
 * @param manifestPath - Path where the manifest.json should be written
 * @param manifest - The manifest data with absolute paths
 * @param workspacePath - Workspace root for computing relative paths
 */
function writeManifest(manifestPath: string, manifest: Manifest, workspacePath: string) {
    // Convert absolute paths to relative for storage
    const relativeEntries: Record<string, ManifestEntry> = {};
    for (const [absKey, entry] of Object.entries(manifest.entries)) {
        const relKey = toRelativePosix(workspacePath, absKey);
        relativeEntries[relKey] = {
            ...entry,
            sourcePath: toRelativePosix(workspacePath, entry.sourcePath),
            outPath: toRelativePosix(workspacePath, entry.outPath),
            dtsPath: entry.dtsPath ? toRelativePosix(workspacePath, entry.dtsPath) : undefined
        };
    }
    const data: Manifest = {
        version: MANIFEST_VERSION,
        entries: relativeEntries
    };
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Updates the manifest with Svelte compiler warnings and CSS diagnostics.
 * These diagnostics are cached per-file to avoid recomputing them on incremental runs
 * when the source files haven't changed.
 *
 * @param emitResult - The emit result containing the manifest and path information
 * @param caches - Maps of file paths to their compiler warnings and CSS diagnostics
 */
export function updateDiagnosticsCache(
    emitResult: EmitResult,
    caches: {
        compilerWarningsByFile?: Map<string, Diagnostic[]>;
        cssDiagnosticsByFile?: Map<string, Diagnostic[]>;
    }
) {
    const hasCompilerWarnings = !!caches.compilerWarningsByFile?.size;
    const hasCssDiagnostics = !!caches.cssDiagnosticsByFile?.size;
    if (!hasCompilerWarnings && !hasCssDiagnostics) {
        return;
    }
    const manifest = emitResult.manifest;
    if (caches.compilerWarningsByFile) {
        for (const [filePath, warnings] of caches.compilerWarningsByFile) {
            const entry = manifest.entries[filePath];
            if (entry) {
                entry.compilerWarnings = warnings;
            }
        }
    }
    if (caches.cssDiagnosticsByFile) {
        for (const [filePath, diagnostics] of caches.cssDiagnosticsByFile) {
            const entry = manifest.entries[filePath];
            if (entry) {
                entry.cssDiagnostics = diagnostics;
            }
        }
    }
    writeManifest(emitResult.manifestPath, manifest, emitResult.workspacePath);
}

/**
 * Resolves the paths to svelte2tsx shim declaration files.
 * These shims provide type definitions for Svelte-specific globals and JSX.
 * Uses different shim versions based on the installed Svelte version (v3 vs v4+).
 *
 * @returns Array of absolute paths to the shim .d.ts files
 */
function resolveSvelte2tsxShims(): string[] {
    const shimNames = [
        Number(VERSION.split('.')[0]) < 4 ? 'svelte-shims.d.ts' : 'svelte-shims-v4.d.ts',
        Number(VERSION.split('.')[0]) < 4 ? 'svelte-jsx.d.ts' : 'svelte-jsx-v4.d.ts'
        // 'svelte-native-jsx.d.ts' // TODO read tsconfig/svelte.config.js to see if it's enabled
    ];
    const resolved: string[] = [];
    for (const name of shimNames) {
        try {
            resolved.push(require.resolve(`./${name}`));
        } catch {
            // ignore missing optional shims
        }
    }
    return resolved;
}
