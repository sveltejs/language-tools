import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { fdir } from 'fdir';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { svelte2tsx } from 'svelte2tsx';
import { parse, VERSION as svelteVersion } from 'svelte/compiler';
import ts from 'typescript';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver-protocol';

type ManifestEntry = {
    sourcePath: string;
    outPath: string;
    mapPath: string;
    dtsPath: string;
    mtimeMs: number;
    size: number;
    isTsFile: boolean;
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
};

export type ParsedDiagnostic = {
    filePath: string;
    range: Range;
    severity: DiagnosticSeverity;
    code: number;
    message: string;
};

const MANIFEST_VERSION = 1;
const CACHE_DIR_NAME = '.svelte-check';
const EMIT_SUBDIR = 'svelte';

export async function emitSvelteFiles(
    workspacePath: string,
    filePathsToIgnore: string[],
    incremental: boolean
): Promise<EmitResult> {
    const cacheDir = path.join(workspacePath, CACHE_DIR_NAME);
    const emitDir = path.join(cacheDir, EMIT_SUBDIR);
    const manifestPath = path.join(cacheDir, 'manifest.json');
    fs.mkdirSync(emitDir, { recursive: true });

    const manifest = loadManifest(manifestPath);
    const svelteFiles = await findSvelteFiles(workspacePath, filePathsToIgnore);
    const currentSet = new Set(svelteFiles);

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
        const hasChanged =
            !incremental ||
            !entry ||
            entry.mtimeMs !== stats.mtimeMs ||
            entry.size !== stats.size ||
            !fs.existsSync(entry.outPath) ||
            !fs.existsSync(entry.mapPath) ||
            !fs.existsSync(entry.dtsPath);

        if (!hasChanged) {
            continue;
        }

        const text = fs.readFileSync(sourcePath, 'utf-8');
        const isTsFile = isTsSvelte(text);
        const outPath = getOutputPath(workspacePath, emitDir, sourcePath, isTsFile);
        const mapPath = `${outPath}.map`;
        const dtsPath = outPath.replace(/\.svelte\.(ts|js)$/, '.svelte.d.ts');

        fs.mkdirSync(path.dirname(outPath), { recursive: true });

        const tsx = svelte2tsx(text, {
            parse,
            version: svelteVersion,
            filename: sourcePath,
            isTsFile,
            mode: 'ts',
            emitOnTemplateError: true
        });

        const map = tsx.map as any;
        if (map) {
            map.sources = [sourcePath];
            map.file = path.basename(outPath);
        }

        const mapFileName = path.basename(mapPath);
        const code = map
            ? `${tsx.code}\n//# sourceMappingURL=${mapFileName}\n`
            : tsx.code;

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

    writeManifest(manifestPath, manifest);

    return {
        cacheDir,
        emitDir,
        manifestPath,
        entries: Object.values(manifest.entries)
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
    const { config } = configFile;
    const baseRootDirs = config?.compilerOptions?.rootDirs ?? [];
    const baseRootDirsAbs = baseRootDirs.map((dir: string) =>
        path.resolve(path.dirname(tsconfigPath), dir)
    );
    const rootDirs = Array.from(new Set([...baseRootDirsAbs, cacheDir]));

    const parsed = ts.parseJsonConfigFileContent(
        config,
        ts.sys,
        path.dirname(tsconfigPath)
    );
    const baseFiles = parsed.fileNames.filter((fileName) => !fileName.endsWith('.svelte'));
    const emittedFiles = emitResult.entries.flatMap((entry) => [entry.outPath, entry.dtsPath]);
    const shimFiles = resolveSvelte2tsxShims();

    const overlay = {
        extends: tsconfigPath,
        compilerOptions: {
            rootDirs,
            allowArbitraryExtensions: true,
            noEmit: true,
            incremental,
            tsBuildInfoFile
        },
        files: Array.from(new Set([...baseFiles, ...emittedFiles, ...shimFiles]))
    };

    fs.writeFileSync(overlayPath, JSON.stringify(overlay, null, 2), 'utf-8');
    return overlayPath;
}

export function runTypeScriptDiagnostics(
    tsconfigPath: string,
    useTsgo: boolean,
    incremental: boolean,
    cwd: string
): ParsedDiagnostic[] {
    const args = [
        '-p',
        tsconfigPath,
        '--pretty',
        'false',
        '--noErrorTruncation'
    ];

    if (incremental) {
        args.push('--incremental');
        args.push('--tsBuildInfoFile', path.join(path.dirname(tsconfigPath), 'tsbuildinfo.json'));
    }

    const command = useTsgo ? 'tsgo' : process.execPath;
    const commandArgs = useTsgo ? args : [require.resolve('typescript/bin/tsc'), ...args];

    const result = spawnSync(command, commandArgs, { encoding: 'utf-8', cwd });
    if (result.error) {
        throw result.error;
    }
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

    return parseDiagnostics(output, cwd);
}

export function mapDiagnosticsToSources(
    diagnostics: ParsedDiagnostic[],
    emitResult: EmitResult
): ParsedDiagnostic[] {
    const entryByOutPath = new Map(
        emitResult.entries.map((entry) => [path.normalize(entry.outPath), entry])
    );

    return diagnostics.map((diag) => {
        const entry = entryByOutPath.get(path.normalize(diag.filePath));
        if (!entry || !fs.existsSync(entry.mapPath)) {
            return diag;
        }

        const map = JSON.parse(fs.readFileSync(entry.mapPath, 'utf-8'));
        const traceMap = new TraceMap(map);
        const start = originalPositionFor(traceMap, {
            line: diag.range.start.line + 1,
            column: diag.range.start.character
        });

        if (!start.line || start.column === null) {
            return diag;
        }

        const sourcePath = map.sources?.[0] || entry.sourcePath;
        return {
            ...diag,
            filePath: sourcePath,
            range: Range.create(
                { line: start.line - 1, character: start.column },
                { line: start.line - 1, character: start.column + 1 }
            )
        };
    });
}

export function toDiagnostics(parsed: ParsedDiagnostic[]): Diagnostic[] {
    return parsed.map((diag) => ({
        range: diag.range,
        severity: diag.severity,
        code: diag.code,
        message: diag.message,
        source: 'ts'
    }));
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
        const resolvedPath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(baseDir, filePath);
        const lineNum = Math.max(0, Number(lineStr) - 1);
        const colNum = Math.max(0, Number(colStr) - 1);
        diagnostics.push({
            filePath: resolvedPath,
            range: Range.create(
                { line: lineNum, character: colNum },
                { line: lineNum, character: colNum + 1 }
            ),
            severity:
                severity === 'warning'
                    ? DiagnosticSeverity.Warning
                    : DiagnosticSeverity.Error,
            code: Number(codeStr),
            message
        });
    }

    return diagnostics;
}

function isTsSvelte(text: string): boolean {
    return /<script[^>]*\blang\s*=\s*["'](ts|typescript)["'][^>]*>/i.test(text);
}

function getOutputPath(
    workspacePath: string,
    emitDir: string,
    sourcePath: string,
    isTsFile: boolean
): string {
    const relPath = path.relative(workspacePath, sourcePath);
    const base = relPath.replace(/\.svelte$/, `.svelte.${isTsFile ? 'ts' : 'js'}`);
    return path.join(emitDir, base);
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

function loadManifest(manifestPath: string): Manifest {
    if (!fs.existsSync(manifestPath)) {
        return { version: MANIFEST_VERSION, entries: {} };
    }
    try {
        const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;
        if (data.version !== MANIFEST_VERSION) {
            return { version: MANIFEST_VERSION, entries: {} };
        }
        return data;
    } catch {
        return { version: MANIFEST_VERSION, entries: {} };
    }
}

function writeManifest(manifestPath: string, manifest: Manifest) {
    const data: Manifest = {
        version: MANIFEST_VERSION,
        entries: manifest.entries
    };
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2), 'utf-8');
}

function resolveSvelte2tsxShims(): string[] {
    const shimNames = [
        'svelte-shims.d.ts',
        'svelte-shims-v4.d.ts',
        'svelte-jsx.d.ts',
        'svelte-jsx-v4.d.ts',
        'svelte-native-jsx.d.ts'
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
