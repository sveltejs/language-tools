import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * animation:xxx(yyy)   --->   {...__sveltets_ensureAnimation(xxx(__sveltets_ElementNode,__sveltets_AnimationMove,(yyy)))}
 */
export function handleAnimateDirective(htmlx: string, str: MagicString, attr: Node): void {
    str.overwrite(
        attr.start,
        htmlx.indexOf(':', attr.start) + 1,
        '{...__sveltets_ensureAnimation('
    );

    if (!attr.expression) {
        str.appendLeft(attr.end, '(__sveltets_ElementNode,__sveltets_AnimationMove))}');
        return;
    }
    str.overwrite(
        htmlx.indexOf(':', attr.start) + 1 + `${attr.name}`.length,
        attr.expression.start,
        '(__sveltets_ElementNode,__sveltets_AnimationMove,('
    );
    str.appendLeft(attr.expression.end, ')))');
    if (htmlx[attr.end - 1] == '"') {
        str.remove(attr.end - 1, attr.end);
    }
}
