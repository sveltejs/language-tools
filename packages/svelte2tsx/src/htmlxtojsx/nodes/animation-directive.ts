import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * animation:xxx(yyy)   --->   {...__sveltets_ensureAnimation(xxx, yyy)}
 */
export function handleAnimateDirective(htmlx: string, str: MagicString, attr: Node): void {
    str.overwrite(
        attr.start,
        htmlx.indexOf(':', attr.start) + 1,
        '{...__sveltets_ensureAnimation(',
    );

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
