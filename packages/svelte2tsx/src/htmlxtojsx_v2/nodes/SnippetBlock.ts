import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { transform, TransformationArray } from '../utils/node-utils';
import { InlineComponent } from './InlineComponent';
import { surroundWithIgnoreComments } from '../../utils/ignore';

/**
 * Transform #snippet into a function
 *
 * ```html
 * {#snippet foo(bar)}
 * ..
 * {/snippet}
 * ```
 * --> if standalone:
 * ```ts
 * const foo = (bar) => {
 * ..
 * }
 * ```
 * --> if slot prop:
 * ```ts
 * foo: (bar) => {
 * ..
 * }
 * ```
 */
export function handleSnippet(
    str: MagicString,
    snippetBlock: BaseNode,
    element?: InlineComponent
): void {
    const endSnippet = str.original.lastIndexOf('{', snippetBlock.end - 1);
    // Return something to silence the "snippet type not assignable to return type void" error
    str.overwrite(endSnippet, snippetBlock.end, 'return __sveltets_2_any(0)}', {
        contentOnly: true
    });

    const startEnd =
        str.original.indexOf('}', snippetBlock.context?.end || snippetBlock.expression.end) + 1;

    if (element !== undefined) {
        str.overwrite(snippetBlock.start, snippetBlock.expression.start, '', { contentOnly: true });
        const transforms: TransformationArray = ['('];
        if (snippetBlock.context) {
            transforms.push([snippetBlock.context.start, snippetBlock.context.end]);
            str.overwrite(snippetBlock.expression.end, snippetBlock.context.start, '', {
                contentOnly: true
            });
            str.overwrite(snippetBlock.context.end, startEnd, '', { contentOnly: true });
        } else {
            str.overwrite(snippetBlock.expression.end, startEnd, '', { contentOnly: true });
        }
        transforms.push(') => {');
        transforms.push([startEnd, snippetBlock.end]);
        element.addProp([[snippetBlock.expression.start, snippetBlock.expression.end]], transforms);
    } else {
        const generic = snippetBlock.context
            ? snippetBlock.context.typeAnnotation
                ? `<${str.original.slice(
                      snippetBlock.context.typeAnnotation.start,
                      snippetBlock.context.typeAnnotation.end
                  )}>`
                : // slap any on to it to silence "implicit any" errors; JSDoc people can't add types to snippets
                  '<any>'
            : '';
        const typeAnnotation = surroundWithIgnoreComments(`: import('svelte').Snippet${generic}`);
        const transforms: TransformationArray = [
            'var ',
            [snippetBlock.expression.start, snippetBlock.expression.end],
            typeAnnotation + ' = ('
        ];

        if (snippetBlock.context) {
            transforms.push([snippetBlock.context.start, snippetBlock.context.end]);
        }

        transforms.push(') => {');
        transform(str, snippetBlock.start, startEnd, startEnd, transforms);
    }
}
