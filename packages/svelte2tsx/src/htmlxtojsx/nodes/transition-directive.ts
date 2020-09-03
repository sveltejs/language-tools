import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * transition:xxx(yyy)   --->   {...__sveltets_ensureTransition(xxx, yyy)}
 */
export function handleTransitionDirective(htmlx: string, str: MagicString, attr: Node): void {
    str.overwrite(
        attr.start,
        htmlx.indexOf(':', attr.start) + 1,
        '{...__sveltets_ensureTransition(',
    );

    if (attr.modifiers.length) {
        const local = htmlx.indexOf('|', attr.start);
        str.remove(local, attr.expression ? attr.expression.start : attr.end);
    }

    if (!attr.expression) {
        str.appendLeft(attr.end, ', {})}');
        return;
    }

    str.overwrite(
        htmlx.indexOf(':', attr.start) + 1 + `${attr.name}`.length,
        attr.expression.start,
        ', ',
    );
    str.appendLeft(attr.expression.end, ')');
    if (htmlx[attr.end - 1] == '"') {
        str.remove(attr.end - 1, attr.end);
    }
}
