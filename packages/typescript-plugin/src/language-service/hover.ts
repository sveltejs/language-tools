import type ts from 'typescript/lib/tsserverlibrary';
import { Logger } from '../logger';
import { findNodeAtPosition, isTopLevelExport } from '../utils';
import { getVirtualLS, kitExports } from './sveltekit';

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
        const virtualPos = toVirtualPos(position);
        const quickInfo = languageService.getQuickInfoAtPosition(fileName, virtualPos);
        if (!quickInfo) return quickInfo;

        const source = languageService.getProgram()?.getSourceFile(fileName);
        const node = source && findNodeAtPosition(source, virtualPos);
        if (node && isTopLevelExport(ts, node, source) && ts.isIdentifier(node)) {
            const name = node.text;
            if (name in kitExports && !quickInfo.documentation?.length) {
                quickInfo.documentation = kitExports[name].documentation;
            }
        }

        return {
            ...quickInfo,
            textSpan: { ...quickInfo.textSpan, start: toOriginalPos(quickInfo.textSpan.start).pos }
        };
    };
}
