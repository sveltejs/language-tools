import * as path from 'path';
import ts from 'typescript';
import { svelte2tsx } from './svelte2tsx';

export interface EmitDtsConfig {
    declarationDir: string;
    svelteShimsPath: string;
    libRoot?: string;
    tsconfig?: string;
}

export async function emitDts(config: EmitDtsConfig) {
    const svelteMap = await createSvelteMap(config);
    const { options, filenames } = loadTsconfig(config, svelteMap);
    const host = await createTsCompilerHost(options, svelteMap);
    const program = ts.createProgram(filenames, options, host);
    const result = program.emit();
    const likely_failed_files = result.diagnostics.filter((diagnostic) => {
        // List of errors which hint at a failed d.ts generation
        // https://github.com/microsoft/TypeScript/blob/main/src/compiler/diagnosticMessages.json
        return (
            diagnostic.code === 2527 ||
            diagnostic.code === 5088 ||
            diagnostic.code === 2742 ||
            (diagnostic.code >= 9005 && diagnostic.code <= 9039) ||
            (diagnostic.code >= 4000 && diagnostic.code <= 4108)
        );
    });

    if (likely_failed_files.length > 0) {
        const failed_by_file = new Map<string, string[]>();
        likely_failed_files.forEach((diagnostic) => {
            const file = diagnostic.file?.fileName;
            if (file) {
                const errors = failed_by_file.get(file) || [];
                errors.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
                failed_by_file.set(file, errors);
            }
        });
        console.warn(
            'd.ts type declaration files for the following files were likely not generated due to the following errors:'
        );
        console.warn(
            [...failed_by_file.entries()]
                .map(([file, errors]) => {
                    return `${file}\n${errors.map((error) => `  - ${error}`).join('\n')}`;
                })
                .join('\n')
        );
    }
}

function loadTsconfig(config: EmitDtsConfig, svelteMap: SvelteMap) {
    const libRoot = config.libRoot || process.cwd();

    const jsconfigFile = ts.findConfigFile(libRoot, ts.sys.fileExists, 'jsconfig.json');
    let tsconfigFile = ts.findConfigFile(libRoot, ts.sys.fileExists, config.tsconfig);

    if (!tsconfigFile && !jsconfigFile) {
        throw new Error('Failed to locate tsconfig or jsconfig');
    }

    tsconfigFile = tsconfigFile || jsconfigFile;
    if (jsconfigFile && isSubpath(path.dirname(tsconfigFile), path.dirname(jsconfigFile))) {
        tsconfigFile = jsconfigFile;
    }

    tsconfigFile = path.isAbsolute(tsconfigFile) ? tsconfigFile : path.join(libRoot, tsconfigFile);
    const basepath = path.dirname(tsconfigFile);
    const { error, config: tsConfig } = ts.readConfigFile(tsconfigFile, ts.sys.readFile);

    if (error) {
        throw new Error('Malformed tsconfig\n' + JSON.stringify(error, null, 2));
    }

    // Rewire includes and files. This ensures that only the files inside the lib are traversed and
    // that the outputted types have the correct directory depth.
    // This is a little brittle because we then may include more than the user wants
    const libPathRelative = path.relative(basepath, libRoot).split(path.sep).join('/');
    if (libPathRelative) {
        tsConfig.include = [`${libPathRelative}/**/*`];
        tsConfig.files = [];
    }

    const { options, fileNames } = ts.parseJsonConfigFileContent(
        tsConfig,
        ts.sys,
        basepath,
        { sourceMap: false, rootDir: config.libRoot },
        tsconfigFile,
        undefined,
        [{ extension: 'svelte', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }]
    );

    const filenames = fileNames.map((name) => {
        if (!isSvelteFilepath(name)) {
            return name;
        }
        // We need to trick TypeScript into thinking that Svelte files
        // are either TS or JS files in order to generate correct d.ts
        // definition files.
        const isTsFile = svelteMap.add(name);
        return name + (isTsFile ? '.ts' : '.js');
    });

    // Add ambient functions so TS knows how to resolve its invocations in the
    // code output of svelte2tsx.
    filenames.push(config.svelteShimsPath);

    return {
        options: {
            ...options,
            noEmit: false, // Set to true in case of jsconfig, force false, else nothing is emitted
            moduleResolution:
                // NodeJS: up to 4.9, Node10: since 5.0
                (ts.ModuleResolutionKind as any).NodeJs ?? ts.ModuleResolutionKind.Node10, // Classic if not set, which gives wrong results
            declaration: true, // Needed for d.ts file generation
            emitDeclarationOnly: true, // We only want d.ts file generation
            declarationDir: config.declarationDir, // Where to put the declarations
            allowNonTsExtensions: true
        },
        filenames
    };
}

async function createTsCompilerHost(options: any, svelteMap: SvelteMap) {
    const host = ts.createCompilerHost(options);
    // TypeScript writes the files relative to the found tsconfig/jsconfig
    // which - at least in the case of the tests - is wrong. Therefore prefix
    // the output paths. See Typescript issue #25430 for more.
    const pathPrefix = path
        .relative(process.cwd(), path.dirname(options.configFilePath))
        .split(path.sep)
        .join('/');

    const svelteSys: ts.System = {
        ...ts.sys,
        fileExists(originalPath) {
            let exists = ts.sys.fileExists(originalPath);
            if (exists) {
                return true;
            }

            const path = ensureRealSvelteFilepath(originalPath);
            if (path === originalPath) {
                return false;
            }

            exists = ts.sys.fileExists(path);
            if (exists && isSvelteFilepath(path)) {
                const isTsFile = svelteMap.add(path);
                if (
                    (isTsFile && !isTsFilepath(originalPath)) ||
                    (!isTsFile && isTsFilepath(originalPath))
                ) {
                    return false;
                }
            }
            return exists;
        },
        readFile(path, encoding = 'utf-8') {
            const sveltePath = ensureRealSvelteFilepath(path);
            if (path !== sveltePath || isSvelteFilepath(path)) {
                const result = svelteMap.get(sveltePath);
                if (result === undefined) {
                    return ts.sys.readFile(path, encoding);
                } else {
                    return result;
                }
            } else {
                return ts.sys.readFile(path, encoding);
            }
        },
        readDirectory(path, extensions, exclude, include, depth) {
            const extensionsWithSvelte = (extensions || []).concat('.svelte');
            return ts.sys.readDirectory(path, extensionsWithSvelte, exclude, include, depth);
        },
        writeFile(fileName, data, writeByteOrderMark) {
            fileName = pathPrefix ? path.join(pathPrefix, fileName) : fileName;
            if (fileName.endsWith('d.ts.map')) {
                data = data.replace(/"sources":\["(.+?)"\]/, (_, sourcePath: string) => {
                    // The inverse of the pathPrefix adjustment
                    sourcePath =
                        pathPrefix && sourcePath.includes(pathPrefix)
                            ? sourcePath.slice(0, sourcePath.indexOf(pathPrefix)) +
                              sourcePath.slice(
                                  sourcePath.indexOf(pathPrefix) + pathPrefix.length + 1
                              )
                            : sourcePath;
                    // Due to our hack of treating .svelte files as .ts files, we need to adjust the extension
                    if (
                        svelteMap.get(path.join(options.rootDir, toRealSvelteFilepath(sourcePath)))
                    ) {
                        sourcePath = toRealSvelteFilepath(sourcePath);
                    }
                    return `"sources":["${sourcePath}"]`;
                });
            } else if (fileName.endsWith('js.map')) {
                data = data.replace(/"sources":\["(.+?)"\]/, (_, sourcePath: string) => {
                    // The inverse of the pathPrefix adjustment
                    sourcePath =
                        pathPrefix && sourcePath.includes(pathPrefix)
                            ? sourcePath.slice(0, sourcePath.indexOf(pathPrefix)) +
                              sourcePath.slice(
                                  sourcePath.indexOf(pathPrefix) + pathPrefix.length + 1
                              )
                            : sourcePath;
                    return `"sources":["${sourcePath}"]`;
                });
            }
            return ts.sys.writeFile(fileName, data, writeByteOrderMark);
        }
    };

    host.fileExists = svelteSys.fileExists;
    host.readFile = svelteSys.readFile;
    host.readDirectory = svelteSys.readDirectory;
    host.writeFile = svelteSys.writeFile;

    host.resolveModuleNames = (
        moduleNames,
        containingFile,
        _reusedNames,
        _redirectedReference,
        compilerOptions
    ) => {
        return moduleNames.map((moduleName) => {
            return resolveModuleName(moduleName, containingFile, compilerOptions);
        });
    };
    host.resolveModuleNameLiterals = (
        moduleLiterals,
        containingFile,
        _redirectedReference,
        compilerOptions
    ) => {
        return moduleLiterals.map((moduleLiteral) => {
            return {
                resolvedModule: resolveModuleName(
                    moduleLiteral.text,
                    containingFile,
                    compilerOptions
                )
            };
        });
    };

    function resolveModuleName(name: string, containingFile: string, compilerOptions: any) {
        // Delegate to the TS resolver first.
        // If that does not bring up anything, try the Svelte Module loader
        // which is able to deal with .svelte files.
        const tsResolvedModule = ts.resolveModuleName(
            name,
            containingFile,
            compilerOptions,
            ts.sys
        ).resolvedModule;
        if (tsResolvedModule && !isVirtualSvelteFilepath(tsResolvedModule.resolvedFileName)) {
            return tsResolvedModule;
        }

        return ts.resolveModuleName(name, containingFile, compilerOptions, svelteSys)
            .resolvedModule;
    }

    return host;
}

interface SvelteMap {
    add: (path: string) => boolean;
    get: (key: string) => string | undefined;
}

/**
 * Generates a map to which we add the transformed code of Svelte files
 * early on when we first need to look at the file contents and can read
 * those transformed source later on.
 */
async function createSvelteMap(config: EmitDtsConfig): Promise<SvelteMap> {
    const svelteFiles = new Map();

    // TODO detect Svelte version in here and set shimsPath accordingly if not given from above
    const noSvelteComponentTyped = config.svelteShimsPath
        .replace(/\\/g, '/')
        .endsWith('svelte2tsx/svelte-shims-v4.d.ts');
    const version = noSvelteComponentTyped ? undefined : '3.42.0';

    function add(path: string): boolean {
        const code = ts.sys.readFile(path, 'utf-8');
        const isTsFile = /<script\s+[^>]*?lang=('|")(ts|typescript)('|")/.test(code);
        const transformed = svelte2tsx(code, {
            filename: path,
            isTsFile,
            mode: 'dts',
            version,
            noSvelteComponentTyped: noSvelteComponentTyped
        }).code;
        svelteFiles.set(path.replace(/\\/g, '/'), transformed);
        return isTsFile;
    }

    return {
        add,
        get: (key: string) => svelteFiles.get(key.replace(/\\/g, '/'))
    };
}

function isSvelteFilepath(filePath: string) {
    return filePath.endsWith('.svelte');
}

function isTsFilepath(filePath: string) {
    return filePath.endsWith('.ts');
}

function isVirtualSvelteFilepath(filePath: string) {
    return filePath.endsWith('.svelte.ts') || filePath.endsWith('svelte.js');
}

function toRealSvelteFilepath(filePath: string) {
    return filePath.slice(0, -3); // -'.js'.length || -'.ts'.length
}

function ensureRealSvelteFilepath(filePath: string) {
    return isVirtualSvelteFilepath(filePath) ? toRealSvelteFilepath(filePath) : filePath;
}

function isSubpath(maybeParent: string, maybeChild: string) {
    const relative = path.relative(maybeParent, maybeChild);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
