import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';

/**
 * {#key expr}content{/key}   --->   {expr} content
 */
export function handleKey(htmlx: string, str: MagicString, keyBlock: BaseNode): void {
    // {#key expr}   ->   {expr}
    str.overwrite(keyBlock.start, keyBlock.expression.start, '{');
    const end = htmlx.indexOf('}', keyBlock.expression.end);
    str.overwrite(keyBlock.expression.end, end + 1, '} ');

    // {/key}   ->
    const endKey = htmlx.lastIndexOf('{', keyBlock.end - 1);
    str.remove(endKey, keyBlock.end);
}
