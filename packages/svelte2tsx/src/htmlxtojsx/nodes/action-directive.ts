import MagicString from 'magic-string';
import { isQuote } from '../utils/node-utils';
import { BaseDirective, BaseNode } from '../../interfaces';

/**
 * use:xxx={params}   --->    {...__sveltets_1_ensureAction(xxx(__sveltets_1_mapElementTag('ParentNodeName'),(params)))}
 */
export function handleActionDirective(
    htmlx: string,
    str: MagicString,
    attr: BaseDirective,
    parent: BaseNode
): void {
    str.overwrite(attr.start, attr.start + 'use:'.length, '{...__sveltets_1_ensureAction(');
    const name = parent.name === 'svelte:body' ? 'body' : parent.name;

    if (!attr.expression) {
        str.appendLeft(attr.end, `(__sveltets_1_mapElementTag('${name}')))}`);
        return;
    }

    str.overwrite(
        attr.start + `use:${attr.name}`.length,
        attr.expression.start,
        `(__sveltets_1_mapElementTag('${name}'),(`
    );
    str.appendLeft(attr.expression.end, ')))');
    const lastChar = htmlx[attr.end - 1];
    if (isQuote(lastChar)) {
        str.remove(attr.end - 1, attr.end);
    }
}
