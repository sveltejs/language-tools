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

import { SourceMapConsumer } from 'source-map'
import { Warning } from 'svelte/types/compiler/interfaces';

function getRelativeFileName(fileName: string): string {
    return path.relative(__dirname, fileName);
}

const categoryFormatMap = {
    [ts.DiagnosticCategory.Warning]: "Warning",
    [ts.DiagnosticCategory.Error]: "Error",
    [ts.DiagnosticCategory.Message]: "Info",
};


function transformDiagnostics(diagnostics: ts.Diagnostic[]): Warning[] {

    let consumers = new Map<ts.SourceFile, SourceMapConsumer>();

    function transformDiagnostic(diagnostic: ts.Diagnostic): Warning {

        if (diagnostic.file) {
            let start = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
            let end = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start + diagnostic.length);

            let sourceMap = (diagnostic.file as any).__svelte_map;
            let relativeFileName = getRelativeFileName(diagnostic.file.fileName);

            if (sourceMap) {
                let decoder = consumers.get(diagnostic.file);
                if (!decoder) {
                    decoder = new SourceMapConsumer(sourceMap);
                    consumers.set(diagnostic.file, decoder);
                }

                for (let pos of [start, end]) {
                    let res = decoder.originalPositionFor({ line: pos.line, column: pos.character })
                    pos.line = res.line;
                    pos.character = res.column;
                }

                relativeFileName = relativeFileName.substring(0, relativeFileName.lastIndexOf(".tsx"))
            }

            let warning: Warning = {
                code: categoryFormatMap[diagnostic.category],
                message: `TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine)}`,
                start: { line: start.line, column: start.character },
                end: { line: end.line, column: end.character },
                filename: relativeFileName,
            }

            return warning;
        }
    }

    return diagnostics.map(transformDiagnostic)
}

export function parseConfigFile(configFilePath: string): ts.ParsedCommandLine {
    let configContents = ts.sys.readFile(configFilePath);
    const { config, error } = ts.parseConfigFileTextToJson(configFilePath, configContents);
    if (error) throw error;
    const configCommandline = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configFilePath));
    return configCommandline
}

export function compile(compilerOptions: ts.CompilerOptions, sourceFiles?: string[]): Warning[] {

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

    return transformDiagnostics(diagnostics);
}
