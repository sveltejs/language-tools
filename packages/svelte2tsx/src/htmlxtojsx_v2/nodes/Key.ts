import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { isImplicitlyClosedBlock, withTrailingPropertyAccess } from '../utils/node-utils';

/**
 * {#key expr}content{/key}   --->   expr; {content}
 */
export function handleKey(str: MagicString, keyBlock: BaseNode): void {
    // {#key expr}   ->   expr;{
    str.overwrite(keyBlock.start, keyBlock.expression.start, '', { contentOnly: true });
    const expressionEnd = withTrailingPropertyAccess(str.original, keyBlock.expression.end);
    const end = str.original.indexOf('}', expressionEnd);
    str.overwrite(expressionEnd, end + 1, '; {');

    // {/key}   -> }
    const endKey = str.original.lastIndexOf('{', keyBlock.end - 1);
    if (!isImplicitlyClosedBlock(endKey, keyBlock)) {
        str.overwrite(endKey, keyBlock.end, '}', { contentOnly: true });
    }
}
