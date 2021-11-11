import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';

/**
 * {#key expr}content{/key}   --->   expr; content
 */
export function handleKey(str: MagicString, keyBlock: BaseNode): void {
    // {#key expr}   ->   expr;
    str.overwrite(keyBlock.start, keyBlock.expression.start, '', { contentOnly: true });
    const end = str.original.indexOf('}', keyBlock.expression.end);
    str.overwrite(keyBlock.expression.end, end + 1, '; ');

    // {/key}   ->
    const endKey = str.original.lastIndexOf('{', keyBlock.end - 1);
    str.overwrite(endKey, keyBlock.end, '', { contentOnly: true });
}
