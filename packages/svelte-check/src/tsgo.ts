import * as syncApi from '@typescript/native-preview/sync';
import type { FileSystem } from '@typescript/native-preview/fs';
import fs from 'node:fs';
import path from 'node:path';
import { svelte2tsx } from 'svelte2tsx';
import { normalizePath, positionAt, getLineOffsets } from 'svelte-language-server';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-protocol';
import { pathToFileURL } from 'node:url';

export function tryLoadApi(tsconfigPath: string): typeof syncApi | null {
    try {
        const apiPath = require.resolve('@typescript/native-preview/sync', {
            paths: [tsconfigPath, __dirname]
        });
        const syncApiModule = require(apiPath);
        return syncApiModule;
    } catch (e) {
        return null;
    }
}

const VIRTUAL_SUFFIX = '_virtual__';

export interface TsgoFileDiagnostics {
    filePath: string;
    text: string;
    diagnostics: Diagnostic[];
}

export interface TsgoDiagnosticsResult {
    diagnosticsByFile: TsgoFileDiagnostics[];
    rootFiles: string[];
    type: 'config' | 'syntactic' | 'semantic/suggestion';
}

export async function getDiagnostics(
    apiModule: typeof syncApi,
    tsconfigPath: string
): Promise<TsgoDiagnosticsResult> {
    const pkgPath = path.dirname(
        require.resolve('@typescript/native-preview/package.json', {
            paths: [tsconfigPath, __dirname]
        })
    );
    const getExePath = await import(
        pathToFileURL(path.join(pkgPath, 'lib', 'getExePath.js')).toString()
    );
    const tsserverPath = getExePath.default();
    const svelteModule = (await require(
        require.resolve('svelte/compiler', {
            paths: [tsconfigPath, __dirname]
        })
    )) as typeof import('svelte/compiler');
    const virtualTsConfigPath = path.join(path.dirname(tsconfigPath), 'tsconfig.virtual.json');
    const fs = createFsProxy(virtualTsConfigPath, svelteModule, tsconfigPath);
    const api = new apiModule.API({
        tsserverPath: tsserverPath,
        fs
    });

    const snapshot = api.updateSnapshot({ openProject: virtualTsConfigPath });
    const lineOffsetsCache = new Map<string, number[]>();

    const project = snapshot.getProject(virtualTsConfigPath);
    if (!project) {
        throw new Error(`Project not found for tsconfig path: ${tsconfigPath}`);
    }

    const program = project.program;
    const files = project.rootFiles
        .filter((file) => !file.endsWith('.d.svelte.ts'))
        .map((file) =>
            file
                .replace(VIRTUAL_SUFFIX + '.ts', '.svelte')
                .replace(VIRTUAL_SUFFIX + '.js', '.svelte')
        );
    const configParsingDiagnostics = program.getConfigFileParsingDiagnostics();
    if (configParsingDiagnostics.length > 0) {
        console.log('config');
        return prepareResult(configParsingDiagnostics, 'config');
    }

    const syntacticDiagnostics = program.getSyntacticDiagnostics();
    if (syntacticDiagnostics.length > 0) {
        console.log('syntactic');
        return prepareResult(syntacticDiagnostics, 'syntactic');
    }

    console.log('semantic/suggestion');
    // TODO: global diagnostics and options diagnostics?
    return prepareResult(
        Array.from(program.getSemanticDiagnostics()).concat(program.getSuggestionDiagnostics()),
        'semantic/suggestion'
    );

    function mapDiagnostic(diag: syncApi.Diagnostic, text: string): Diagnostic {
        const lineOffsets = diag.fileName
            ? getLineOffsetsFromCache(diag.fileName, text)
            : undefined;
        const startPos = lineOffsets
            ? positionAt(diag.pos, text, lineOffsets)
            : { line: 0, character: 0 };
        const endPos = lineOffsets
            ? positionAt(diag.end, text, lineOffsets)
            : { line: 0, character: 0 };
        return {
            message: diag.text,
            range: {
                start: startPos,
                end: endPos
            },
            severity: mapDiagnosticCategory(diag.category)
        };
    }

    function getLineOffsetsFromCache(filePath: string, text: string): number[] {
        let lineOffsets = lineOffsetsCache.get(filePath);
        if (lineOffsets) {
            return lineOffsets;
        }

        lineOffsets = getLineOffsets(text);
        lineOffsetsCache.set(filePath, lineOffsets);
        return lineOffsets;
    }

    function mapDiagnosticCategory(category: syncApi.DiagnosticCategory): Diagnostic['severity'] {
        switch (category) {
            case syncApi.DiagnosticCategory.Error:
                return DiagnosticSeverity.Error;
            case syncApi.DiagnosticCategory.Warning:
                return DiagnosticSeverity.Warning;
            case syncApi.DiagnosticCategory.Message:
            case syncApi.DiagnosticCategory.Suggestion:
                return DiagnosticSeverity.Information;
        }
    }

    function prepareResult(
        diagnostics: readonly syncApi.Diagnostic[],
        type: 'config' | 'syntactic' | 'semantic/suggestion'
    ): TsgoDiagnosticsResult {
        const diagnosticsByFile = new Map<
            string,
            { filePath: string; text: string; diagnostics: Diagnostic[] }
        >();
        for (const diag of diagnostics) {
            const fileName = diag.fileName ?? tsconfigPath;
            let bucket = diagnosticsByFile.get(fileName);
            if (!bucket) {
                bucket = { filePath: fileName, text: fs.readFile(fileName) ?? '', diagnostics: [] };
                diagnosticsByFile.set(fileName, bucket);
            }
            bucket.diagnostics.push(mapDiagnostic(diag, bucket.text));
        }

        return {
            diagnosticsByFile: Array.from(diagnosticsByFile.values()),
            rootFiles: files,
            type
        };
    }
}

function createFsProxy(
    virtualTsConfigPath: string,
    svelteModule: typeof import('svelte/compiler'),
    tsconfigPath: string
): Required<Pick<FileSystem, 'readFile' | 'fileExists' | 'getAccessibleEntries'>> {
    // const svelteFiles = new Map<string, SvelteFile>();
    const parse = svelteModule.parse;
    const svelteVersion = svelteModule.VERSION;
    const virtualFiles = new Map<string, string>();
    const svelteExtLength = '.svelte'.length;

    const tsconfigDir = path.dirname(tsconfigPath);
    const shimFiles = resolveSvelte2tsxShims(svelteVersion).map((fileName) =>
        path.relative(tsconfigDir, fileName).replace(/\\/g, '/')
    );

    const virtualTsConfigContent = JSON.stringify({
        extends: './' + path.basename(tsconfigPath),
        compilerOptions: { allowArbitraryExtensions: true },
        files: shimFiles
    });
    virtualFiles.set(normalizePath(virtualTsConfigPath), virtualTsConfigContent);

    return {
        getAccessibleEntries(directory: string) {
            const files: string[] = [];
            const directories: string[] = [];
            try {
                const entries = fs.readdirSync(directory, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isFile()) {
                        addFileEntry(path.join(directory, entry.name));
                    } else if (entry.isDirectory()) {
                        directories.push(entry.name);
                    } else if (entry.isSymbolicLink()) {
                        const fullPath = path.join(directory, entry.name);
                        const stats = fs.statSync(fullPath);
                        if (stats.isFile()) {
                            addFileEntry(fullPath);
                        } else if (stats.isDirectory()) {
                            directories.push(entry.name);
                        }
                    }
                }

                return {
                    files: files,
                    directories: directories
                };
            } catch (error) {
                console.error(`Error reading directory ${directory}:`, error);
                return undefined;
            }

            function addFileEntry(fullPath: string) {
                if (fullPath.endsWith('.svelte')) {
                    files.push(...addVirtualSvelteFile(fullPath));
                } else {
                    files.push(path.basename(fullPath));
                }
            }
        },
        readFile(path: string) {
            const virtualEntry = virtualFiles.get(normalizePath(path));
            if (virtualEntry !== undefined) {
                return virtualEntry;
            }

            return fs.readFileSync(path, 'utf-8');
        },
        fileExists(path: string) {
            if (path.endsWith('.d.svelte.ts')) {
                if (fs.existsSync(path) || virtualFiles.has(normalizePath(path))) {
                    return true;
                }

                const targetSvelteFile = path.slice(0, -'.d.svelte.ts'.length) + '.svelte';

                if (fs.existsSync(targetSvelteFile)) {
                    addVirtualSvelteFile(targetSvelteFile);
                    return true;
                }
            }

            return fs.existsSync(path);
        }
    };

    function loadSvelteFile(path: string): { code: string; kind: 'ts' | 'js' } {
        const text = fs.readFileSync(path, 'utf-8');
        const isTsFile = isTsSvelte(text);

        const tsx = svelte2tsx(text, {
            parse,
            version: svelteVersion,
            filename: path,
            isTsFile,
            mode: 'ts',
            emitOnTemplateError: false,
            emitJsDoc: true // without this, tsc/tsgo will choke on the syntactic errors and not emit semantic errors
        });

        return { code: tsx.code, kind: isTsFile ? 'ts' : 'js' };
    }

    function addVirtualSvelteFile(filePath: string) {
        let svelteFile: { code: string; kind: 'ts' | 'js' };
        try {
            svelteFile = loadSvelteFile(filePath);
        } catch (err) {
            return [];
        }
        const normalizedPath = normalizePath(filePath);

        const dtsPath = normalizedPath.slice(0, -svelteExtLength) + '.d.svelte.ts';
        const virtualPath =
            normalizedPath.slice(0, -svelteExtLength) + VIRTUAL_SUFFIX + '.' + svelteFile.kind;
        virtualFiles.set(virtualPath, svelteFile.code);
        const dtsBasename = path.basename(dtsPath);
        const virtualBasename = path.basename(virtualPath);

        const dtsImportPath = `./${virtualBasename}`;
        const dtsContent = `export { default } from "${dtsImportPath}";\nexport * from "${dtsImportPath}";\n`;
        virtualFiles.set(dtsPath, dtsContent);

        return [dtsBasename, virtualBasename];
    }
}

/**
 * Checks if a Svelte file contains a TypeScript script block (lang="ts" or lang="typescript").
 */
function isTsSvelte(text: string): boolean {
    // Regex to match <script> tags and capture their attributes section.
    //   - <script\b ...attributes... >
    //   - Attributes: sequence of whitespace + name, optionally =value (double/single/unquoted)
    const scriptTagRegex = /<script\b((?:\s+[^=>'"\/\s]+(?:=(?:"[^"]*"|'[^']*'|[^>\s]+))?)*)\s*>/gi;

    // Regex to match a lang attribute (case-insensitive, with optional whitespace), capturing its value:
    //   - Double quoted: "value" (group 1)
    //   - Single quoted: 'value' (group 2)
    //   - Unquoted: bareword (group 3)
    const langAttrRegex = /\blang\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

    let scriptMatch: RegExpExecArray | null;
    while ((scriptMatch = scriptTagRegex.exec(text)) !== null) {
        const attrs = scriptMatch[1] ?? '';
        const langMatch = langAttrRegex.exec(attrs);
        if (!langMatch) {
            continue;
        }

        const lang = (langMatch[1] ?? langMatch[2] ?? langMatch[3] ?? '').toLowerCase();
        if (lang === 'ts' || lang === 'typescript') {
            return true;
        }
    }

    return false;
}

/**
 * Resolves the paths to svelte2tsx shim declaration files.
 * These shims provide type definitions for Svelte-specific globals and JSX.
 * Uses different shim versions based on the installed Svelte version (v3 vs v4+).
 *
 * @returns Array of absolute paths to the shim .d.ts files
 */
function resolveSvelte2tsxShims(svelteVersion: string): string[] {
    const shimNames = [
        Number(svelteVersion.split('.')[0]) < 4 ? 'svelte-shims.d.ts' : 'svelte-shims-v4.d.ts',
        Number(svelteVersion.split('.')[0]) < 4 ? 'svelte-jsx.d.ts' : 'svelte-jsx-v4.d.ts'
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
