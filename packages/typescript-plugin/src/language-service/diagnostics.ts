import path from 'path';
import { internalHelpers } from 'svelte2tsx';
import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { findIdentifier, isSvelteFilePath } from '../utils';
import { getVirtualLS, isKitRouteExportAllowedIn, kitExports } from './sveltekit';

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
            if (diagnostic.code === 2307) {
                diagnostic = {
                    ...diagnostic,
                    // adjust length so it doesn't spill over to the next line
                    length: 1,
                    messageText:
                        typeof diagnostic.messageText === 'string' &&
                        diagnostic.messageText.includes('./$types')
                            ? diagnostic.messageText +
                              ` (this likely means that SvelteKit's type generation didn't run yet - try running it by executing 'npm run dev' or 'npm run build')`
                            : diagnostic.messageText
                };
            } else if (diagnostic.code === 2694) {
                diagnostic = {
                    ...diagnostic,
                    // adjust length so it doesn't spill over to the next line
                    length: 1,
                    messageText:
                        typeof diagnostic.messageText === 'string' &&
                        diagnostic.messageText.includes('/$types')
                            ? diagnostic.messageText +
                              ` (this likely means that SvelteKit's generated types are out of date - try rerunning it by executing 'npm run dev' or 'npm run build')`
                            : diagnostic.messageText
                };
            } else if (diagnostic.code === 2355) {
                // A function whose declared type is neither 'void' nor 'any' must return a value
                diagnostic = {
                    ...diagnostic,
                    // adjust length so it doesn't spill over to the next line
                    length: 1
                };
            } else {
                continue;
            }
        }

        diagnostic = {
            ...diagnostic,
            start: mapped.pos
        };

        diagnostics.push(diagnostic);
    }

    if (methodName === 'getSemanticDiagnostics') {
        // We're in a Svelte file - check top level exports
        // We're using the original file to have the correct position without mapping
        const source = info.languageService.getProgram()?.getSourceFile(fileName);
        const basename = path.basename(fileName);
        const validExports = Object.keys(kitExports).filter((key) =>
            isKitRouteExportAllowedIn(basename, kitExports[key])
        );
        if (source && basename.startsWith('+')) {
            const exports = internalHelpers.findExports(ts, source, /* irrelevant */ false);
            for (const exportName of exports.keys()) {
                if (!validExports.includes(exportName) && !exportName.startsWith('_')) {
                    const node = exports.get(exportName)!.node;
                    const identifier = findIdentifier(ts, node) ?? node;

                    diagnostics.push({
                        file: source,
                        start: identifier.getStart(),
                        length: identifier.getEnd() - identifier.getStart(),
                        messageText: `Invalid export '${exportName}' (valid exports are ${validExports.join(
                            ', '
                        )}, or anything with a '_' prefix)`,
                        // make it a warning in case people are stuck on old versions and new exports are added to SvelteKit
                        category: ts.DiagnosticCategory.Warning,
                        code: 71001 // arbitrary
                    });
                }
            }
        }
    }

    // @ts-ignore TS doesn't get the return type right
    return diagnostics;
}
