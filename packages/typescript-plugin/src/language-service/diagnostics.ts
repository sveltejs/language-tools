import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { isSvelteFilePath } from '../utils';
import { getVirtualLS } from './sveltekit';

type _ts = typeof ts;

export function decorateDiagnostics(
    ls: ts.LanguageService,
    info: ts.server.PluginCreateInfo,
    typescript: typeof ts,
    logger: Logger
): void {
    decorateSyntacticDiagnostics(ls, info, typescript, logger);
    decorateSemanticDiagnostics(ls, info, typescript, logger);
    decorateSuggestionDiagnostics(ls, info, typescript, logger);
}

function decorateSyntacticDiagnostics(
    ls: ts.LanguageService,
    info: ts.server.PluginCreateInfo,
    typescript: typeof ts,
    logger: Logger
): void {
    const getSyntacticDiagnostics = ls.getSyntacticDiagnostics;
    ls.getSyntacticDiagnostics = (fileName: string) => {
        // Diagnostics inside Svelte files are done
        // by the svelte-language-server / Svelte for VS Code extension
        if (isSvelteFilePath(fileName)) {
            return [];
        }

        const kitDiagnostics = getKitDiagnostics(
            'getSyntacticDiagnostics',
            fileName,
            info,
            typescript,
            logger
        );
        return kitDiagnostics ?? getSyntacticDiagnostics(fileName);
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

        const kitDiagnostics = getKitDiagnostics(
            'getSemanticDiagnostics',
            fileName,
            info,
            typescript,
            logger
        );
        return kitDiagnostics ?? getSemanticDiagnostics(fileName);
    };
}

function decorateSuggestionDiagnostics(
    ls: ts.LanguageService,
    info: ts.server.PluginCreateInfo,
    typescript: typeof ts,
    logger: Logger
): void {
    const getSuggestionDiagnostics = ls.getSuggestionDiagnostics;
    ls.getSuggestionDiagnostics = (fileName: string) => {
        // Diagnostics inside Svelte files are done
        // by the svelte-language-server / Svelte for VS Code extension
        if (isSvelteFilePath(fileName)) {
            return [];
        }

        const kitDiagnostics = getKitDiagnostics(
            'getSuggestionDiagnostics',
            fileName,
            info,
            typescript,
            logger
        );
        return kitDiagnostics ?? getSuggestionDiagnostics(fileName);
    };
}

function getKitDiagnostics<
    T extends 'getSemanticDiagnostics' | 'getSuggestionDiagnostics' | 'getSyntacticDiagnostics'
>(
    methodName: T,
    fileName: string,
    info: ts.server.PluginCreateInfo,
    ts: _ts,
    logger?: Logger
): ReturnType<ts.LanguageService[T]> | undefined {
    const result = getVirtualLS(fileName, info, ts, logger);
    if (!result) return;

    const { languageService, toOriginalPos } = result;

    const diagnostics = [];
    for (let diagnostic of languageService[methodName](fileName)) {
        if (!diagnostic.start || !diagnostic.length) {
            diagnostics.push(diagnostic);
            continue;
        }

        const mapped = toOriginalPos(diagnostic.start);
        if (mapped.inGenerated) {
            // If not "Cannot find module './$types' .." then filter out
            if (diagnostic.code !== 2307) {
                continue;
            } else {
                diagnostic = {
                    ...diagnostic,
                    // adjust length so it doesn't spill over to the next line
                    length: 1,
                    messageText:
                        typeof diagnostic.messageText === 'string' &&
                        diagnostic.messageText.includes('./$types')
                            ? diagnostic.messageText +
                              ` (this likely means that SvelteKit's type generation didn't run yet)`
                            : diagnostic.messageText
                };
            }
        }

        diagnostic = {
            ...diagnostic,
            start: mapped.pos
        };

        diagnostics.push(diagnostic);
    }

    // @ts-ignore TS doesn't get the return type right
    return diagnostics;
}
