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

        const { languageService, length, pos } = result;

        const quickInfo = languageService.getQuickInfoAtPosition(
            fileName,
            position < pos ? position : position + length
        );
        if (!quickInfo) return quickInfo;

        if (quickInfo.textSpan.start > pos) {
            quickInfo.textSpan.start -= length;
        }

        return quickInfo;
    };
}
