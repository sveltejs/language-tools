import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { getVirtualLS } from './proxy';

type _ts = typeof ts;

export function decorateHover(
    ls: ts.LanguageService,
    info: ts.server.PluginCreateInfo,
    ts: _ts,
    logger: Logger
): void {
    const getQuickInfoAtPosition = ls.getQuickInfoAtPosition;

    ls.getQuickInfoAtPosition = (fileName: string, position: number) => {
        const result = getVirtualLS(fileName, info, ts);
        if (!result) return getQuickInfoAtPosition(fileName, position);

        const { languageService, toOriginalPos, toVirtualPos } = result;
        const quickInfo = languageService.getQuickInfoAtPosition(fileName, toVirtualPos(position));
        if (!quickInfo) return quickInfo;

        return {
            ...quickInfo,
            textSpan: { ...quickInfo.textSpan, start: toOriginalPos(quickInfo.textSpan.start).pos }
        };
    };
}
