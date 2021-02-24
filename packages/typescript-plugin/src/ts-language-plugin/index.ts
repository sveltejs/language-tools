import ts from 'typescript/lib/tsserverlibrary';
import { enableLanguageSupport } from './internals';
import { LineChar, _ts } from './types';
import { getExtensionFromScriptKind, testForExtension } from './utils';

export interface LanguageFileMapper {
    readonly generatedText: string;
    readonly originalLineStarts?: number[];
    readonly generatedlineStarts?: number[];
    getGeneratedPosition(pos: LineChar): LineChar;
    getOriginalPosition(pos: LineChar): LineChar;
}
export interface TransformedLanguageFile {
    content: string;
    mappings: string;
}
export interface TSLanguagePlugin {
    extension: string;
    scriptKind?: ts.ScriptKind;
    extensionKind?: ts.Extension;
    transform(fileName: string, text: string): LanguageFileMapper | TransformedLanguageFile;
}
export interface TSLanguagePluginFactory {
    (host: TSPluginOptions): TSLanguagePlugin;
}
interface TSPluginOptions extends ts.server.PluginCreateInfo {
    ts: typeof ts;
}
export interface TSPluginContext extends TSPluginOptions {
    ts: _ts;
    // languageServiceHost = project
    config: any;
}
export function createLanguagePlugin(
    options: TSLanguagePlugin | TSLanguagePluginFactory
): ts.server.PluginModuleFactory {
    return (modules) => ({
        create(info) {
            if (typeof options === 'function')
                options = options({ ...info, ts: modules.typescript });
            const context = { ...info, ts: modules.typescript } as TSPluginContext;
            const extension = options.extension.replace(/^\.?/, '.');
            const scriptKind = options.scriptKind ?? context.ts.ScriptKind.TSX;
            const extensionKind =
                options.extensionKind ?? getExtensionFromScriptKind(context, scriptKind);
            enableLanguageSupport(context, {
                extension,
                scriptKind,
                extensionKind,
                transform: options.transform,
                disabled: [
                    'getApplicableRefactors',
                    'getSemanticDiagnostics',
                    'getSyntacticDiagnostics',
                    'getSuggestionDiagnostics',
                    'getQuickInfoAtPosition',
                    'getFormattingEditsAfterKeystroke',
                    'getCodeFixesAtPosition'
                ],
                is: testForExtension(extension)
            });
            return info.languageService;
        }
    });
}
