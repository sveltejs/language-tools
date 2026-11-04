import { BaseDirective } from '../../interfaces';
import { Element } from './Element';
import { getLeadingCommentTransformation, getTrailingCommentTransformation } from './Comment';
import { SpanMapGenerator } from '../../utils/spanMap';

/**
 * use:xxx={params}   --->    __sveltets_2_ensureAction(xxx(svelte.mapElementTag('ParentNodeName'),(params)));
 */
export function handleActionDirective(
    attr: BaseDirective,
    element: Element,
    spanMapGenerator: SpanMapGenerator
): void {
    element.addAction(
        attr,
        getLeadingCommentTransformation(attr),
        getTrailingCommentTransformation(attr),
        spanMapGenerator
    );
}
