import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';

/**
 * class:xx={yyy}   --->   {...__sveltets_1_ensureType(Boolean, !!(yyy))}
 */
export function handleClassDirective(str: MagicString, attr: BaseDirective): void {
    str.overwrite(attr.start, attr.expression.start, '{...__sveltets_1_ensureType(Boolean, !!(');
    const endBrackets = '))}';
    if (attr.end !== attr.expression.end) {
        str.overwrite(attr.expression.end, attr.end, endBrackets);
    } else {
        str.appendLeft(attr.end, endBrackets);
    }
}
