import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import {
    addDirectiveNameMapping,
    getDirectiveNameStartEndIdx,
    rangeWithTrailingPropertyAccess,
    TransformationArray
} from '../utils/node-utils';
import { Element } from './Element';
import { getLeadingCommentTransformation } from './Comment';
import { getTrailingCommentTransformation } from './Comment';
import { SpanMapGenerator } from '../../utils/spanMap';
import { surroundWithIgnoreComments } from '../../utils/ignore';

/**
 * transition|modifier:xxx(yyy)   --->   __sveltets_2_ensureTransition(xxx(svelte.mapElementTag('..'),(yyy)));
 *
 * In content mapper mode, with the arguments Svelte passes if the function requires a third one:
 * `xxx(..., (yyy), ...__sveltets_2_transitionRest(xxx))` adds `{ direction }`. Otherwise TypeScript
 * reports "Expected 3 arguments" for such functions; TS6 filters that with the checker afterwards.
 * Without params in the template, TypeScript still reports that error.
 */
export function handleTransitionDirective(
    str: MagicString,
    attr: BaseDirective,
    element: Element,
    spanMapGenerator: SpanMapGenerator | undefined
): void {
    const trailingComments = getTrailingCommentTransformation(attr);
    const nameRange = getDirectiveNameStartEndIdx(str, attr);
    const mapElement = addDirectiveNameMapping(
        spanMapGenerator,
        nameRange,
        `${element.typingsNamespace}.mapElementTag('${element.tagName}')`
    );
    const transformations: TransformationArray = [
        ...getLeadingCommentTransformation(attr),
        '__sveltets_2_ensureTransition(',
        nameRange,
        `(${mapElement}`
    ];
    if (attr.expression) {
        transformations.push(
            ',(',
            rangeWithTrailingPropertyAccess(str.original, attr.expression),
            ')'
        );
    }
    if (spanMapGenerator) {
        // The copy of the name is ignored (an undefined name is reported once, at the name); the
        // arguments are reported at the directive name
        const name = surroundWithIgnoreComments(str.original.slice(nameRange[0], nameRange[1]));
        transformations.push(
            ', ',
            spanMapGenerator.mapGenerated(`...__sveltets_2_transitionRest(${name})`, nameRange)
        );
    }
    transformations.push('));', ...trailingComments);
    element.appendToStartEnd(transformations);
}
