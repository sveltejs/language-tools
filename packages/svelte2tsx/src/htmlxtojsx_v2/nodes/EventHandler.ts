import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';
import { rangeWithTrailingPropertyAccess, surroundWith } from '../utils/node-utils';
import { Element } from './Element';
import { InlineComponent } from './InlineComponent';
import { getLeadingCommentTransformation, getTrailingCommentTransformation } from './Comment';
import { mapGenerated, SpanMapFeature, SpanMapGenerator } from '../../utils/spanMap';

const eventNameFeatures =
    SpanMapFeature.Definition |
    SpanMapFeature.Hover |
    SpanMapFeature.References |
    SpanMapFeature.Completion;

const componentNameFeatures = eventNameFeatures | SpanMapFeature.Rename;

/**
 * Transform on:xxx={yyy}
 * - For DOM elements: ---> onxxx: yyy,
 * - For Svelte components/special elements: ---> componentInstance.$on("xxx", yyy)}
 */
export function handleEventHandler(
    str: MagicString,
    attr: BaseDirective,
    element: Element | InlineComponent,
    spanMapGenerator: SpanMapGenerator | undefined
): void {
    const nameStart = str.original.indexOf(':', attr.start) + 1;
    // If there's no expression, it's event bubbling (on:click)
    const nameEnd = nameStart + attr.name.length;
    const leadingComments = getLeadingCommentTransformation(attr);
    const trailingComments = getTrailingCommentTransformation(attr);
    spanMapGenerator?.addSourceSpan(nameStart, nameEnd);
    // the generated prefix of the name maps to its start
    const prefix = (text: string) =>
        mapGenerated(
            spanMapGenerator,
            text,
            [nameStart, nameStart],
            element instanceof InlineComponent ? componentNameFeatures : eventNameFeatures
        );

    if (element instanceof Element) {
        // Prefix with "on:" for better mapping.
        // Surround with quotes because event name could contain invalid prop chars.
        surroundWith(str, [nameStart, nameEnd], prefix('"on:'), '"');
        element.addAttribute(
            [...leadingComments, [nameStart, nameEnd]],
            attr.expression
                ? [
                      rangeWithTrailingPropertyAccess(str.original, attr.expression),
                      ...trailingComments
                  ]
                : ['undefined', ...trailingComments]
        );
    } else {
        element.addEvent(
            [nameStart, nameEnd],
            attr.expression
                ? rangeWithTrailingPropertyAccess(str.original, attr.expression)
                : undefined,
            leadingComments,
            trailingComments,
            prefix('"')
        );
    }
}
