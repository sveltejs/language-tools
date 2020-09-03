import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * class:xx={yyy}   --->   {...__sveltets_ensureType(Boolean, !!(yyy))}
 */
export function handleClassDirective(str: MagicString, attr: Node): void {
    str.overwrite(attr.start, attr.expression.start, `{...__sveltets_ensureType(Boolean, !!(`);
    const endBrackets = `))}`;
    if (attr.end !== attr.expression.end) {
        str.overwrite(attr.expression.end, attr.end, endBrackets);
    } else {
        str.appendLeft(attr.end, endBrackets);
    }
}
