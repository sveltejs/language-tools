import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * {@debug ...}   --->   {...}
 */
export function handleDebug(htmlx: string, str: MagicString, debugBlock: Node): void {
    const tokenStart = htmlx.indexOf('@debug', debugBlock.start);
    str.remove(tokenStart, tokenStart + '@debug'.length);
}
