import * as path from 'path';
import ts from 'typescript';
import { svelte2tsx } from './svelte2tsx';

export interface EmitDtsConig {
    declarationDir: string;
    svelteShimsPath: string;
    libRoot?: string;
}

export async function emitDts(config: EmitDtsConig) {
    const svelteMap = await createSvelteMap(config);
    const { options, filenames } = loadTsconfig(config, svelteMap);
    const host = await createTsCompilerHost(options, svelteMap);
    const program = ts.createProgram(filenames, options, host);
    program.emit();
}

function loadTsconfig(config: EmitDtsConig, svelteMap: SvelteMap) {
    const libRoot = config.libRoot || process.cwd();

    const jsconfigFile = ts.findConfigFile(libRoot, ts.sys.fileExists, 'jsconfig.json');
    let tsconfigFile = ts.findConfigFile(libRoot, ts.sys.fileExists);

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
        { sourceMap: false },
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
            moduleResolution: ts.ModuleResolutionKind.NodeJs, // Classic if not set, which gives wrong results
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
    const pathPrefix = path.relative(process.cwd(), path.dirname(options.configFilePath));

    const svelteSys: ts.System = {
        ...ts.sys,
        fileExists(originalPath) {
            const path = ensureRealSvelteFilepath(originalPath);
            const exists = ts.sys.fileExists(path);
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
            if (isVirtualSvelteFilepath(path) || isSvelteFilepath(path)) {
                path = ensureRealSvelteFilepath(path);
                return svelteMap.get(path);
            } else {
                return ts.sys.readFile(path, encoding);
            }
        },
        readDirectory(path, extensions, exclude, include, depth) {
            const extensionsWithSvelte = (extensions || []).concat('.svelte');
            return ts.sys.readDirectory(path, extensionsWithSvelte, exclude, include, depth);
        },
        writeFile(fileName, data, writeByteOrderMark) {
            return ts.sys.writeFile(
                pathPrefix ? path.join(pathPrefix, fileName) : fileName,
                data,
                writeByteOrderMark
            );
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
async function createSvelteMap(config): Promise<SvelteMap> {
    const svelteFiles = new Map();

    function add(path: string): boolean {
        const code = ts.sys.readFile(path, 'utf-8');
        const isTsFile = // svelte-preprocess allows default languages
            ['ts', 'typescript'].includes(config.preprocess?.defaultLanguages?.script) ||
            /<script\s+[^>]*?lang=('|")(ts|typescript)('|")/.test(code);
        const transformed = svelte2tsx(code, {
            filename: path,
            isTsFile,
            mode: 'dts'
        }).code;
        svelteFiles.set(path, transformed);
        return isTsFile;
    }

    return { add, get: (key: string) => svelteFiles.get(key) };
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
