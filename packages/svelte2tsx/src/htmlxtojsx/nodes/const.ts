import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';

/**
 * {@const ...}   --->   {const ...}
 */
export function handleConstTag(htmlx: string, str: MagicString, rawBlock: BaseNode): void {
    const tokenStart = htmlx.indexOf('@const', rawBlock.start);
    str.remove(tokenStart, tokenStart + '@'.length);
}
