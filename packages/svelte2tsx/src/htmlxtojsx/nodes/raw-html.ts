import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * {@html ...}   --->   {...}
 */
export function handleRawHtml(htmlx: string, str: MagicString, rawBlock: Node): void {
    const tokenStart = htmlx.indexOf('@html', rawBlock.start);
    str.remove(tokenStart, tokenStart + '@html'.length);
}
