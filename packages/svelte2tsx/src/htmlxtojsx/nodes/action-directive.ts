import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * use:xxx   --->    {...__sveltets_ensureAction(__sveltets_mapElementTag('ParentNodeName', xxx))}
 */
export function handleActionDirective(
    htmlx: string,
    str: MagicString,
    attr: Node,
    parent: Node,
): void {
    str.overwrite(
        attr.start,
        attr.start + 'use:'.length,
        `{...__sveltets_ensureAction(__sveltets_mapElementTag('${parent.name}'),`,
    );

    if (!attr.expression) {
        str.appendLeft(attr.end, ')}');
        return;
    }

    str.overwrite(attr.start + `use:${attr.name}`.length, attr.expression.start, ',');
    str.appendLeft(attr.expression.end, ')');
    if (htmlx[attr.end - 1] == '"') {
        str.remove(attr.end - 1, attr.end);
    }
}
