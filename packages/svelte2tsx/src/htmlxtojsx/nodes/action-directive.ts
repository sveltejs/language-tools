import MagicString from 'magic-string';
import { BaseDirective, BaseNode } from '../../interfaces';
import { handle_subset } from '../utils/node-utils';

/**
 * use:xxx={params}   --->    {...__sveltets_ensureAction(xxx(__sveltets_mapElementTag('ParentNodeName'),(params)))}
 */
export function handleActionDirective(
    _htmlx: string,
    str: MagicString,
    attr: BaseDirective,
    parent: BaseNode
): void {
    const subset = handle_subset(str, attr);

    if (attr.expression == null) {
        const [action] = subset.deconstruct`use:${attr.name}`;
        subset.edit`{...__sveltets_ensureAction(${action}(__sveltets_mapElementTag('${parent.name}')))}`;
    } else {
        // prettier-ignore
        const [action, expression] = subset.deconstruct`use:${attr.name}=["']?{${attr.expression}}["']?`;
        subset.edit`{...__sveltets_ensureAction(${action}(__sveltets_mapElementTag('${parent.name}'),(${expression})))}`;
    }
}
