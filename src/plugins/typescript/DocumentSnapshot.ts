import ts from 'typescript';
import { Document } from '../../api';
import { getScriptKindFromTypeAttribute } from './utils';

export interface DocumentSnapshot extends ts.IScriptSnapshot {
    version: number;
    scriptKind: ts.ScriptKind;
    compilerOptions: ts.CompilerOptions;
    files: string[];
}

export namespace DocumentSnapshot {
    export function fromDocument(
        document: Document,
        defaultCompilerOptions: ts.CompilerOptions,
        prev?: DocumentSnapshot,
    ): DocumentSnapshot {
        const text = document.getText();
        const length = document.getTextLength();
        const scriptKind = getScriptKind(document);

        let compilerOptions: ts.CompilerOptions;
        let files: string[];

        if (!prev || prev.scriptKind !== scriptKind) {
            const opts = getCompilerOptions(document, defaultCompilerOptions);
            compilerOptions = opts.compilerOptions;
            files = opts.files;
        } else {
            compilerOptions = prev.compilerOptions;
            files = prev.files;
        }

        return {
            version: document.version,
            scriptKind,
            compilerOptions,
            files,
            getText: (start, end) => text.substring(start, end),
            getLength: () => length,
            getChangeRange: () => undefined,
        };
    }

    export function getScriptKind(document: Document) {
        return getScriptKindFromTypeAttribute(document.getAttributes().type);
    }
}

function getCompilerOptions(
    document: Document,
    defaultOptions: ts.CompilerOptions,
): { compilerOptions: ts.CompilerOptions; files: string[] } {
    const searchPath = document.getFilePath()!;
    const configFilename =
        ts.findConfigFile(searchPath, ts.sys.fileExists, 'tsconfig.json') ||
        ts.findConfigFile(searchPath, ts.sys.fileExists, 'jsconfig.json');
    const configJson = configFilename && ts.readConfigFile(configFilename, ts.sys.readFile).config;

    let files: string[] = [];
    let compilerOptions = { ...defaultOptions };
    if (configJson) {
        const parsedConfig = ts.parseJsonConfigFileContent(
            configJson,
            ts.sys,
            '',
            defaultOptions,
            configFilename,
            undefined,
            [
                { extension: 'html', isMixedContent: true },
                { extension: 'svelte', isMixedContent: true },
            ],
        );
        files = parsedConfig.fileNames;
        compilerOptions = { ...compilerOptions, ...parsedConfig.options };
    }
    return { compilerOptions, files };
}
