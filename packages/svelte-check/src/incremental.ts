import { fdir } from 'fdir';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
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
    line: number;
    character: number;
    severity: DiagnosticSeverity;
    code: number;
    message: string;
};

const MANIFEST_VERSION = 1;
const CACHE_DIR_NAME = '.svelte-check';
const EMIT_SUBDIR = 'svelte';

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
    const include = rebaseConfigSpecs(parsed.raw?.include, tsconfigDir, overlayDir);
    const exclude = rebaseConfigSpecs(parsed.raw?.exclude, tsconfigDir, overlayDir);
    const configFiles = rebaseConfigSpecs(parsed.raw?.files, tsconfigDir, overlayDir)?.filter(
        (fileName) => !fileName.endsWith('.svelte')
    );
    const emittedFiles = emitResult.entries
        .flatMap((entry) => [entry.outPath, entry.dtsPath])
        .map((fileName) => toRelativePosix(overlayDir, fileName));
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
        files: Array.from(new Set([...(configFiles ?? []), ...emittedFiles, ...shimFiles])),
        ...(include !== undefined ? { include } : {}),
        ...(exclude !== undefined ? { exclude } : {})
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
    const args = ['-p', tsconfigPath, '--pretty', 'false', '--noErrorTruncation'];

    if (incremental) {
        args.push('--incremental');
        args.push(
            '--tsBuildInfoFile',
            toPosixPath(path.join(path.dirname(tsconfigPath), 'tsbuildinfo.json'))
        );
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
    const outPath = path.join(
        path.dirname(baseOutputPath),
        `++${path.basename(baseOutputPath)}`
    );
    const dtsPath = baseOutputPath.replace(/\.svelte\.(ts|js)$/, '.svelte.d.ts');
    return {
        outPath: outPath.replace(/\\/g, '/'),
        dtsPath: dtsPath.replace(/\\/g, '/')
    };
}

function rebaseConfigSpecs(
    specs: unknown,
    fromDir: string,
    toDir: string
): string[] | undefined {
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
