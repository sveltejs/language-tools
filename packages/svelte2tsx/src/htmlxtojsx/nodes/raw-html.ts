import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';

/**
 * {@html ...}   --->   {...}
 */
export function handleRawHtml(htmlx: string, str: MagicString, rawBlock: BaseNode): void {
    const tokenStart = htmlx.indexOf('@html', rawBlock.start);
    str.remove(tokenStart, tokenStart + '@html'.length);
}
