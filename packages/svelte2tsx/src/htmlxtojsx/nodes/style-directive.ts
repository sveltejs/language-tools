import MagicString from 'magic-string';
import { StyleDirective } from '../../interfaces';

/**
 * style:xx={yy}  --->   __sveltets_1_ensureStyle(xx, yy);
 */
export function handleAttribute(str: MagicString, attr: StyleDirective): void {
    str.overwrite(
        attr.start,
        str.original.indexOf(':', attr.start) + 1,
        '{...__sveltets_1_ensureStyle('
    );

    if (attr.value !== true) {
        str.overwrite(str.original.indexOf('=', attr.start), attr.value[0].start, ',');
    }

    const endBrackets = ')}';
    if (attr.expression && attr.end !== attr.expression.end) {
        str.overwrite(attr.expression.end, attr.end, endBrackets);
    } else {
        str.appendLeft(attr.end, endBrackets);
    }
}
