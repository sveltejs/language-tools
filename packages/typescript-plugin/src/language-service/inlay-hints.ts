import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { getVirtualLS } from './sveltekit';

type _ts = typeof ts;

export function decorateInlayHints(
    ls: ts.LanguageService,
    info: ts.server.PluginCreateInfo,
    ts: _ts,
    logger: Logger
): void {
    const provideInlayHints = ls.provideInlayHints;
    ls.provideInlayHints = (fileName, span, preferences) => {
        const result = getVirtualLS(fileName, info, ts);
        if (!result) {
            return provideInlayHints(fileName, span, preferences);
        }

        const { languageService, toVirtualPos, toOriginalPos } = result;
        return languageService
            .provideInlayHints(
                fileName,
                {
                    start: toVirtualPos(span.start),
                    length: span.length
                },
                preferences
            )
            .map((hint) => ({
                ...hint,
                position: toOriginalPos(hint.position).pos
            }));
    };
}
