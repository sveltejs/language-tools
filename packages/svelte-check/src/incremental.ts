import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { svelte2tsx } from 'svelte2tsx';
import { parse, VERSION as svelteVersion, VERSION } from 'svelte/compiler';
import ts from 'typescript';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver-protocol';
import { mapSvelteCheckDiagnostics } from 'svelte-language-server';
import { findSvelteFiles } from './utils';

type ManifestEntry = {
    sourcePath: string;
    outPath: string;
    mapPath: string;
    dtsPath: string;
    mtimeMs: number;
    size: number;
    isTsFile: boolean;
    compilerWarnings?: Diagnostic[];
    cssDiagnostics?: Diagnostic[];
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
    severity: DiagnosticSeverity;
    code: number;
    message: string;
};

const MANIFEST_VERSION = 1;
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

    const manifest = loadManifest(manifestPath, workspacePath);
    const svelteFiles = await findSvelteFiles(workspacePath, filePathsToIgnore);
    const currentSet = new Set(svelteFiles);
    const changedFiles: string[] = [];

    // Remove deleted files
    for (const [sourcePath, entry] of Object.entries(manifest.entries)) {
        if (!currentSet.has(sourcePath)) {
            deleteEntry(entry);
            delete manifest.entries[sourcePath];
        }
    }

    for (const sourcePath of svelteFiles) {
        const stats = fs.statSync(sourcePath);
        const entry = manifest.entries[sourcePath];

        // When file stats match the cached entry, avoid reading the file just to determine isTsFile
        const statsUnchanged =
            !!entry && entry.mtimeMs === stats.mtimeMs && entry.size === stats.size;
        let text: string | undefined;
        let isTsFile: boolean;

        if (statsUnchanged) {
            isTsFile = entry.isTsFile;
        } else {
            text = fs.readFileSync(sourcePath, 'utf-8');
            isTsFile = isTsSvelte(text);
        }

        const { outPath, dtsPath } = getOutputPaths(workspacePath, emitDir, sourcePath, isTsFile);
        const mapPath = `${outPath}.map`;

        const outPathChanged = !!entry && entry.outPath !== outPath;
        if (outPathChanged) {
            deleteEntry(entry);
        }

        const hasChanged =
            !incremental ||
            !entry ||
            outPathChanged ||
            !statsUnchanged ||
            !fs.existsSync(entry.outPath) ||
            !fs.existsSync(entry.mapPath) ||
            !fs.existsSync(entry.dtsPath);

        if (!hasChanged) {
            continue;
        }
        changedFiles.push(sourcePath);

        if (!text) {
            text = fs.readFileSync(sourcePath, 'utf-8');
        }

        fs.mkdirSync(path.dirname(outPath), { recursive: true });

        const tsx = svelte2tsx(text, {
            parse,
            version: svelteVersion,
            filename: sourcePath,
            isTsFile,
            mode: 'ts',
            emitOnTemplateError: false,
            emitJsDoc: true // without this, tsc/tsgo will choke on the syntactic errors and not emit semantic errors
        });

        const map = tsx.map as any;
        if (map) {
            map.sources = [sourcePath];
            map.file = path.basename(outPath);
        }

        const mapFileName = path.basename(mapPath);
        const code = map ? `${tsx.code}\n//# sourceMappingURL=${mapFileName}\n` : tsx.code;

        fs.writeFileSync(outPath, code, 'utf-8');
        if (map) {
            fs.writeFileSync(mapPath, JSON.stringify(map), 'utf-8');
        } else if (fs.existsSync(mapPath)) {
            fs.unlinkSync(mapPath);
        }

        const dtsImportPath = `./${path.basename(outPath)}`;
        const dtsContent = `export { default } from "${dtsImportPath}";\nexport * from "${dtsImportPath}";\n`;
        fs.writeFileSync(dtsPath, dtsContent, 'utf-8');

        manifest.entries[sourcePath] = {
            sourcePath,
            outPath,
            mapPath,
            dtsPath,
            mtimeMs: stats.mtimeMs,
            size: stats.size,
            isTsFile
        };
    }

    writeManifest(manifestPath, manifest, workspacePath);

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
 * @returns Path to the generated overlay tsconfig.json
 */
export function writeOverlayTsconfig(
    tsconfigPath: string,
    emitResult: EmitResult,
    incremental: boolean
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
    const baseRootDirs =
        parsed.options.rootDirs ?? configFile.config?.compilerOptions?.rootDirs ?? [];
    const baseRootDirsAbs = baseRootDirs.map((dir: string) =>
        path.resolve(path.join(path.dirname(tsconfigPath)), dir)
    );
    const rootDirs = Array.from(new Set([...baseRootDirsAbs, path.join(cacheDir, 'svelte')])).map(
        (dir) => toRelativePosix(overlayDir, dir)
    );
    const tsconfigDir = path.dirname(tsconfigPath);
    const rawInclude = normalizeConfigSpecs(parsed.raw?.include);
    const rawExclude = normalizeConfigSpecs(parsed.raw?.exclude);
    const rawFiles = normalizeConfigSpecs(parsed.raw?.files);
    const include = rebaseConfigSpecs(rawInclude, tsconfigDir, overlayDir);
    const exclude = rebaseConfigSpecs(rawExclude, tsconfigDir, overlayDir);
    const configFiles = rebaseConfigSpecs(rawFiles, tsconfigDir, overlayDir);
    // Turn include specs that match .svelte files into corresponding includes for our virtual files.
    // We do this here instead of filtering on includes/excludes before deciding which Svelte files to
    // virtualize because includes/excludes could only do starting points and module resolution could
    // find other .svelte files which need to be included, too.
    const virtualInclude = rawInclude
        ?.filter((spec) => spec.endsWith('.svelte') || spec.endsWith('*'))
        .map((spec) => {
            const normalized = spec
                .replace(/^\$\{configDir\}/i, '.')
                .replace(/\.svelte$/, '.svelte.d.ts');
            return `${EMIT_SUBDIR}/${normalized}`;
        });
    const mergedInclude = [...(include ?? []), ...(virtualInclude ?? [])];
    // Same for excludes.
    const virtualExclude = rawExclude
        ?.filter((spec) => spec.endsWith('.svelte') || spec.endsWith('*'))
        .map((spec) => {
            const normalized = spec
                .replace(/^\$\{configDir\}/i, '.')
                .replace(/\.svelte$/, '.svelte.d.ts');
            return `${EMIT_SUBDIR}/${normalized}`;
        });
    const mergedExclude = [...(exclude ?? []), ...(virtualExclude ?? [])];
    const shimFiles = resolveSvelte2tsxShims().map((fileName) =>
        toRelativePosix(overlayDir, fileName)
    );

    const overlay = {
        extends: toRelativePosix(overlayDir, tsconfigPath),
        compilerOptions: {
            rootDirs,
            allowArbitraryExtensions: true,
            noEmit: true,
            incremental,
            tsBuildInfoFile: toRelativePosix(overlayDir, tsBuildInfoFile)
        },
        files: Array.from(new Set([...(configFiles ?? []), ...shimFiles])),
        ...(mergedInclude.length ? { include: mergedInclude } : {}),
        ...(mergedExclude.length ? { exclude: mergedExclude } : {})
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
        'false',
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
    const diagnosticsByFile = new Map<string, ParsedDiagnostic[]>();
    for (const diagnostic of diagnostics) {
        const key = path.normalize(diagnostic.filePath);
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
            const generatedText = fs.readFileSync(entry.outPath, 'utf-8');
            const tsDiagnostics = fileDiagnostics.map((diag) =>
                cliDiagnosticToTsDiagnostic(diag, entry.outPath, generatedText, entry.isTsFile)
            );
            const mappedDiagnostics = mapSvelteCheckDiagnostics(
                entry.sourcePath,
                sourceText,
                entry.isTsFile,
                tsDiagnostics
            );

            results.set(entry.sourcePath, {
                filePath: entry.sourcePath,
                text: sourceText,
                diagnostics: mappedDiagnostics
            });
        } else {
            const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
            const source = isTypescriptFile(filePath) ? 'ts' : 'js';
            const mappedDiagnostics = fileDiagnostics.map((diag) => ({
                range: Range.create(
                    { line: diag.line, character: diag.character },
                    { line: diag.line, character: diag.character + 1 }
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

/**
 * Parses TypeScript compiler output into structured diagnostic objects.
 * Expects diagnostics in the format: `file(line,col): error|warning TSxxxx: message`
 *
 * @param output - Raw stdout/stderr output from the TypeScript compiler
 * @param baseDir - Base directory for resolving relative file paths
 * @returns Array of parsed diagnostics with absolute file paths and 0-based positions
 */
function parseDiagnostics(output: string, baseDir: string): ParsedDiagnostic[] {
    const diagnostics: ParsedDiagnostic[] = [];
    const lines = output.split(/\r?\n/);
    const regex = /^(.*)\((\d+),(\d+)\): (error|warning) TS(\d+): (.*)$/;

    for (const line of lines) {
        const match = regex.exec(line.trim());
        if (!match) {
            continue;
        }
        const [, filePath, lineStr, colStr, severity, codeStr, message] = match;
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
        const lineNum = Math.max(0, Number(lineStr) - 1);
        const colNum = Math.max(0, Number(colStr) - 1);
        diagnostics.push({
            filePath: resolvedPath,
            line: lineNum,
            character: colNum,
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
 * Creates a source file from the generated text to calculate precise byte positions
 * and infer the length of the error span from identifier boundaries.
 *
 * @param diag - Parsed diagnostic from CLI output
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
        // tsc CLI output doesn't include span lengths; approximate by matching
        // the identifier at the error position. Falls back to length 1 for
        // non-identifier positions (operators, string literals, etc.).
        length: (() => {
            const text = generatedText.slice(start, start + 100);
            const match = /^[a-zA-Z0-9_$]+/.exec(text);
            return match ? match[0].length : 1;
        })(),
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

function deleteEntry(entry: ManifestEntry) {
    safeUnlink(entry.outPath);
    safeUnlink(entry.mapPath);
    safeUnlink(entry.dtsPath);
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
            const absKey = path.resolve(workspacePath, relKey);
            resolvedEntries[absKey] = {
                ...entry,
                sourcePath: path.resolve(workspacePath, entry.sourcePath),
                outPath: path.resolve(workspacePath, entry.outPath),
                mapPath: path.resolve(workspacePath, entry.mapPath),
                dtsPath: path.resolve(workspacePath, entry.dtsPath)
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
            mapPath: toRelativePosix(workspacePath, entry.mapPath),
            dtsPath: toRelativePosix(workspacePath, entry.dtsPath)
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
            resolved.push(require.resolve(`svelte2tsx/${name}`));
        } catch {
            // ignore missing optional shims
        }
    }
    return resolved;
}
