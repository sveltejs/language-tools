export { svelte2tsx } from './svelte2tsx'
export { htmlx2jsx } from './htmlxtojsx'


//* try tp get errors
import * as ts from "typescript";
import * as path from "path";
import { svelte2tsx } from './svelte2tsx';
import * as fs from 'fs';

let baseHost = {
   
    writeFile: (fileName, content) => ts.sys.writeFile(fileName, content),
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    getDirectories: path => ts.sys.getDirectories(path),
    getCanonicalFileName: fileName =>
        ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    getNewLine: () => ts.sys.newLine,
    useCaseSensitiveFileNames:() => ts.sys.useCaseSensitiveFileNames,
    fileExists: fileName => ts.sys.fileExists(fileName),
    readDirectory: ts.sys.readDirectory.bind(ts.sys),
    readFile: fileName => ts.sys.readFile(fileName)
}


function createCompilerHost(
    options: ts.CompilerOptions,
    moduleSearchLocations: string[]
): ts.CompilerHost {
    let host = {
        ...baseHost,
        getSourceFile,
        resolveModuleNames,
    //    resolveTypeReferenceDirectives,
        getDefaultLibFileName: () => ts.getDefaultLibFilePath(options),
     //   getDefaultLibLocation: () => path.dirname(ts.getDefaultLibFilePath(options))
    } as ts.CompilerHost;

    return host;

    function getSourceFile(
        fileName: string,
        languageVersion: ts.ScriptTarget,
        onError?: (message: string) => void
    ) {
        let sourceText
        console.log('reading source file', fileName);
        if (fileName.endsWith(".svelte.tsx")) {
            let originalName = fileName.substring(0, fileName.length - ".tsx".length);
            console.log("Converting "+originalName + " to tsx");
            sourceText = ts.sys.readFile(originalName);
            sourceText = svelte2tsx(sourceText).code;
            fileName = originalName;
        } else {
            sourceText = ts.sys.readFile(fileName);
        }

        return sourceText !== undefined
            ? ts.createSourceFile(fileName, sourceText, languageVersion)
            : undefined;
    }

    function resolveModuleNames(
        moduleNames: string[],
        containingFile: string
    ): ts.ResolvedModule[] {
        console.log("resolving module names");
        const resolvedModules: ts.ResolvedModule[] = [];
        for (const moduleName of moduleNames) {
            // try to use standard resolution
            let result = ts.resolveModuleName(moduleName, containingFile, options, {
                fileExists: host.fileExists,
                readFile: host.readFile
            });

            if (result.resolvedModule) {
                console.log("resolved module ",result.resolvedModule.resolvedFileName)
                resolvedModules.push(result.resolvedModule);
            } else {
                // check fallback locations, for simplicity assume that module at location
                // should be represented by '.d.ts' file
                for (const location of moduleSearchLocations) {
                    const modulePath = path.join(location, moduleName + ".d.ts");
                    if (host.fileExists(modulePath)) {
                        resolvedModules.push({ resolvedFileName: modulePath });
                    }
                }
            }
        }
        console.log(moduleNames, resolvedModules.map(x=>x.resolvedFileName));
        return resolvedModules;
    }
}

function compile(sourceFiles: string[], moduleSearchLocations: string[]): void {
    /*const options: ts.CompilerOptions = {
        module: ts.ModuleKind.AMD,
        target: ts.ScriptTarget.ES5
    };*/



    let configContents = ts.sys.readFile("./test/tsconfig.json"); 
    const { config: optionsJson, error}  = ts.parseConfigFileTextToJson("./test/tsconfig.json",configContents);
    if (error) {
        console.log(error);
    }
    const configOptions = ts.convertCompilerOptionsFromJson(optionsJson.compilerOptions, path.resolve(__dirname));
    console.log(configOptions.errors);
    //let options = configOptions.options;
    //options.project = __dirname;
    //console.log('sourceFiles', sourceFiles); */
   // const options = ts.getDefaultCompilerOptions();
   // options.target = ts.ScriptTarget.ES2016;
    
    const host = createCompilerHost(configOptions.options, moduleSearchLocations);
    const program = ts.createProgram(sourceFiles, configOptions.options, host);
    //program.emit(undefined, fn=>console.log("wanted to write",fn))
    //console.log(program.getSourceFiles())
    //console.log('global', program.getGlobalDiagnostics())

    console.log('semantic', program.getSemanticDiagnostics().map(x=> `${x.messageText} ${x.file.fileName}:${x.start}`));
    /// do something with program...
}

//cli?
if (require.main === module) {
    console.log("Compiling test")
    let sources = process.argv.slice(2);
    sources.unshift("svelte-jsx.d.ts");
    sources.unshift("svelte-shims.d.ts");
    console.log(ts.sys.resolvePath("node_modules/typescript/lib"));
    compile(sources.map(s => ts.sys.resolvePath(s)), [ts.sys.resolvePath("node_modules/typescript/lib")] );
}