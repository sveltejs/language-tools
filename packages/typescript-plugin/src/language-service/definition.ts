import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { SvelteSnapshotManager } from '../svelte-snapshots';
import { isNotNullOrUndefined, isSvelteFilePath } from '../utils';
import { getVirtualLS } from './sveltekit';

type _ts = typeof ts;

export function decorateGetDefinition(
    ls: ts.LanguageService,
    info: ts.server.PluginCreateInfo,
    ts: _ts,
    snapshotManager: SvelteSnapshotManager,
    logger: Logger
): void {
    const getDefinitionAndBoundSpan = ls.getDefinitionAndBoundSpan;
    ls.getDefinitionAndBoundSpan = (fileName, position) => {
        const definition = getDefinitionAndBoundSpan(fileName, position);
        if (!definition?.definitions) {
            return getKitDefinitions(ts, info, fileName, position);
        }

        return {
            ...definition,
            definitions: definition.definitions
                .map((def) => {
                    if (!isSvelteFilePath(def.fileName)) {
                        return def;
                    }

                    let textSpan = snapshotManager
                        .get(def.fileName)
                        ?.getOriginalTextSpan(def.textSpan);
                    if (!textSpan) {
                        // Unmapped positions are for example the default export.
                        // Fall back to the start of the file to at least go to the correct file.
                        textSpan = { start: 0, length: 1 };
                    }
                    return {
                        ...def,
                        textSpan,
                        // Spare the work for now
                        originalTextSpan: undefined,
                        contextSpan: undefined,
                        originalContextSpan: undefined
                    };
                })
                .filter(isNotNullOrUndefined)
        };
    };
}

function getKitDefinitions(
    ts: _ts,
    info: ts.server.PluginCreateInfo,
    fileName: string,
    position: number
) {
    const result = getVirtualLS(fileName, info, ts);
    if (!result) return;
    const { languageService, toOriginalPos, toVirtualPos } = result;
    const virtualPos = toVirtualPos(position);
    const definitions = languageService.getDefinitionAndBoundSpan(fileName, virtualPos);
    if (!definitions) return;
    // Assumption: This is only called when the original definitions didn't turn up anything.
    // Therefore we are called on things like export function load ({ fetch }) .
    // This means the textSpan needs conversion but none of the definitions because they are all referencing other files.
    return {
        ...definitions,
        textSpan: { ...definitions.textSpan, start: toOriginalPos(definitions.textSpan.start).pos }
    };
}
