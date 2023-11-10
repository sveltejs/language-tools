import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { transform, TransformationArray } from '../utils/node-utils';
import { InlineComponent } from './InlineComponent';

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
    str.overwrite(endSnippet, snippetBlock.end, '}', {
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
        const transforms: TransformationArray = [
            'const ',
            [snippetBlock.expression.start, snippetBlock.expression.end],
            ' = ('
        ];
        if (snippetBlock.context) {
            transforms.push([snippetBlock.context.start, snippetBlock.context.end]);
        }
        transforms.push(') => {');

        transform(str, snippetBlock.start, startEnd, startEnd, transforms);
    }
}
