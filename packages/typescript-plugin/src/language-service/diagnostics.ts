import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { isSvelteFilePath } from '../utils';
import { getVirtualLS } from './proxy';

type _ts = typeof ts;

export function decorateDiagnostics(
    ls: ts.LanguageService,
    info: ts.server.PluginCreateInfo,
    typescript: typeof ts,
    logger: Logger
): void {
    decorateSyntacticDiagnostics(ls);
    decorateSemanticDiagnostics(ls, info, typescript, logger);
    decorateSuggestionDiagnostics(ls);
}

function decorateSyntacticDiagnostics(ls: ts.LanguageService): void {
    const getSyntacticDiagnostics = ls.getSyntacticDiagnostics;
    ls.getSyntacticDiagnostics = (fileName: string) => {
        // Diagnostics inside Svelte files are done
        // by the svelte-language-server / Svelte for VS Code extension
        if (isSvelteFilePath(fileName)) {
            return [];
        }
        return getSyntacticDiagnostics(fileName);
    };
}

function decorateSemanticDiagnostics(
    ls: ts.LanguageService,
    info: ts.server.PluginCreateInfo,
    typescript: typeof ts,
    logger: Logger
): void {
    const getSemanticDiagnostics = ls.getSemanticDiagnostics;
    ls.getSemanticDiagnostics = (fileName: string) => {
        // Diagnostics inside Svelte files are done
        // by the svelte-language-server / Svelte for VS Code extension
        if (isSvelteFilePath(fileName)) {
            return [];
        }
        const kitDiagnostics = getKitDiagnostics(fileName, info, typescript, logger);
        return kitDiagnostics ?? getSemanticDiagnostics(fileName);
    };
}

function decorateSuggestionDiagnostics(ls: ts.LanguageService): void {
    const getSuggestionDiagnostics = ls.getSuggestionDiagnostics;
    ls.getSuggestionDiagnostics = (fileName: string) => {
        // Diagnostics inside Svelte files are done
        // by the svelte-language-server / Svelte for VS Code extension
        if (isSvelteFilePath(fileName)) {
            return [];
        }
        return getSuggestionDiagnostics(fileName);
    };
}

function getKitDiagnostics(
    fileName: string,
    info: ts.server.PluginCreateInfo,
    ts: _ts,
    logger: Logger
) {
    const result = getVirtualLS(fileName, info, ts, logger);
    if (!result) return;

    const { languageService, length, pos } = result;

    return languageService.getSemanticDiagnostics(fileName).map((diagnostic) => {
        if (!diagnostic.start || !diagnostic.length) return diagnostic;

        if (diagnostic.start <= pos) return diagnostic;

        return {
            ...diagnostic,
            start: diagnostic.start - length
        };
    });
}
