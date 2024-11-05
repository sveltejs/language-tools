import { BaseDirective } from '../../interfaces';
import { Element } from './Element';

/**
 * use:xxx={params}   --->    __sveltets_2_ensureAction(xxx(svelte.mapElementTag('ParentNodeName'),(params)));
 */
export function handleActionDirective(attr: BaseDirective, element: Element): void {
    element.addAction(attr);
}
