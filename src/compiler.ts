import { svelte2tsx } from './svelte2tsx';
import * as ts from 'typescript';
//import * as fs from 'fs';
import * as path from 'path';

function createCompilerHost(configOptions): ts.CompilerHost {
   
    function getSourceFile(fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void) {
        let sourceText;
        console.log('reading source file', fileName);
        if (fileName.endsWith(".svelte.tsx")) {
            let originalName = fileName.substring(0, fileName.length - ".tsx".length);
            console.log("Converting " + originalName + " to tsx");
            sourceText = ts.sys.readFile(originalName);
            let output = svelte2tsx(sourceText);

            let srcFile = ts.createSourceFile(fileName, output.code, languageVersion);
            (srcFile as any).__svelte_map = output.map;
            return srcFile;
            //fs.writeFileSync(fileName, sourceText);
        }
        else {
            sourceText = ts.sys.readFile(fileName);
            return sourceText !== undefined
            ? ts.createSourceFile(fileName, sourceText, languageVersion)
            : undefined;
        }
    }

    let original = ts.createCompilerHost(configOptions);
    return { ...original, getSourceFile }
}


export function parseConfigFile(configFilePath: string): ts.ParsedCommandLine {
    let configContents = ts.sys.readFile(configFilePath);
    const { config, error } = ts.parseConfigFileTextToJson(configFilePath, configContents);
    if (error) throw error;
    const configCommandline = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configFilePath));
    return configCommandline
}


export function compile(compilerOptions: ts.CompilerOptions, sourceFiles?: string[]): ts.Diagnostic[] {

    //compile
    const host = createCompilerHost(compilerOptions);
    const program = ts.createProgram(sourceFiles, compilerOptions, host);

    //collect any errors
    let diagnostics: ts.Diagnostic[];
    // First get and report any syntactic errors.
    diagnostics = [...program.getSyntacticDiagnostics()];
    // If we didn't have any syntactic errors, then also try getting the global and
    // semantic errors.
    if (diagnostics.length === 0) {
        diagnostics = [...program.getOptionsDiagnostics().concat(program.getGlobalDiagnostics())];
        if (diagnostics.length === 0) {
            diagnostics = [...program.getSemanticDiagnostics()];
        }
    }

    return diagnostics;
}
