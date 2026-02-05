import { fdir } from 'fdir';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { svelte2tsx } from 'svelte2tsx';
import { parse, VERSION as svelteVersion, VERSION } from 'svelte/compiler';
import ts from 'typescript';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver-protocol';
import { mapSvelteCheckDiagnostics } from 'svelte-language-server';

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

export type EmittedFile = ManifestEntry;

export type EmitResult = {
    cacheDir: string;
    emitDir: string;
    manifestPath: string;
    entries: ManifestEntry[];
    changedFiles: string[];
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
        const text = fs.readFileSync(sourcePath, 'utf-8');
        const isTsFile = isTsSvelte(text);
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
            entry.mtimeMs !== stats.mtimeMs ||
            entry.size !== stats.size ||
            !fs.existsSync(entry.outPath) ||
            !fs.existsSync(entry.mapPath) ||
            !fs.existsSync(entry.dtsPath);

        if (!hasChanged) {
            continue;
        }
        changedFiles.push(sourcePath);

        fs.mkdirSync(path.dirname(outPath), { recursive: true });

        const tsx = svelte2tsx(text, {
            parse,
            version: svelteVersion,
            filename: sourcePath,
            isTsFile,
            mode: 'ts',
            emitOnTemplateError: false
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
        changedFiles
    };
}

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

function isTsSvelte(text: string): boolean {
    return /<script[^>]*\blang\s*=\s*["'](ts|typescript)["'][^>]*>/i.test(text);
}

function isTypescriptFile(filePath: string): boolean {
    return /\.(ts|tsx|mts|cts)$/.test(filePath);
}

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

function rebaseConfigSpecs(specs: unknown, fromDir: string, toDir: string): string[] | undefined {
    if (!Array.isArray(specs)) {
        return undefined;
    }
    return specs.map((spec) => rebaseConfigSpec(String(spec), fromDir, toDir));
}

function rebaseConfigSpec(spec: string, fromDir: string, toDir: string): string {
    const configDirPattern = /^\$\{configDir\}/i;
    const resolved = configDirPattern.test(spec)
        ? path.resolve(fromDir, spec.replace(configDirPattern, '.'))
        : path.isAbsolute(spec)
          ? spec
          : path.resolve(fromDir, spec);
    return toRelativePosix(toDir, resolved);
}

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

export function updateDiagnosticsCache(
    manifestPath: string,
    workspacePath: string,
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
    const manifest = loadManifest(manifestPath, workspacePath);
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
    writeManifest(manifestPath, manifest, workspacePath);
}

function resolveSvelte2tsxShims(): string[] {
    const shimNames = [
        Number(VERSION.split('.')) < 4 ? 'svelte-shims.d.ts' : 'svelte-shims-v4.d.ts',
        Number(VERSION.split('.')) < 4 ? 'svelte-jsx.d.ts' : 'svelte-jsx-v4.d.ts'
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

function createIgnored(filePathsToIgnore: string[]): Array<(path: string) => boolean> {
    return filePathsToIgnore.map((i) => {
        if (i.endsWith('**')) i = i.slice(0, -2);

        if (i.startsWith('**')) {
            i = i.slice(2);

            if (i.includes('*'))
                throw new Error(
                    'Invalid svelte-check --ignore pattern: Only ** at the start or end is supported'
                );

            return (path) => path.includes(i);
        }

        if (i.includes('*'))
            throw new Error(
                'Invalid svelte-check --ignore pattern: Only ** at the start or end is supported'
            );

        return (path) => path.startsWith(i);
    });
}

async function findSvelteFiles(
    workspacePath: string,
    filePathsToIgnore: string[]
): Promise<string[]> {
    const offset = workspacePath.length + 1;
    const ignored = createIgnored(filePathsToIgnore);
    const isIgnored = (filePath: string) => {
        const relative = filePath.slice(offset);
        for (const i of ignored) {
            if (i(relative)) {
                return true;
            }
        }
        return false;
    };

    return new fdir()
        .filter((filePath) => filePath.endsWith('.svelte') && !isIgnored(filePath))
        .exclude((_, filePath) => {
            return filePath.includes('/node_modules/') || filePath.includes('/.');
        })
        .withPathSeparator('/')
        .withFullPaths()
        .crawl(workspacePath)
        .withPromise();
}
