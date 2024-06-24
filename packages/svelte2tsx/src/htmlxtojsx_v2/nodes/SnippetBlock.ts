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
    component?: InlineComponent
): void {
    const isImplicitProp = component !== undefined;
    const endSnippet = str.original.lastIndexOf('{', snippetBlock.end - 1);
    // Return something to silence the "snippet type not assignable to return type void" error
    str.overwrite(
        endSnippet,
        snippetBlock.end,
        `};return __sveltets_2_any(0)}${isImplicitProp ? '' : ';'}`,
        {
            contentOnly: true
        }
    );

    const lastParameter = snippetBlock.parameters?.at(-1);

    const startEnd =
        str.original.indexOf(
            '}',
            lastParameter?.typeAnnotation?.end ?? lastParameter?.end ?? snippetBlock.expression.end
        ) + 1;

    if (isImplicitProp) {
        str.overwrite(snippetBlock.start, snippetBlock.expression.start, '', { contentOnly: true });
        const transforms: TransformationArray = ['('];
        if (snippetBlock.parameters?.length) {
            const start = snippetBlock.parameters[0].start;
            const end = lastParameter.typeAnnotation?.end ?? lastParameter.end;
            transforms.push([start, end]);
            str.overwrite(snippetBlock.expression.end, start, '', {
                contentOnly: true
            });
            str.overwrite(end, startEnd, '', { contentOnly: true });
        } else {
            str.overwrite(snippetBlock.expression.end, startEnd, '', { contentOnly: true });
        }
        transforms.push(') => {async () => {'); // inner async function for potential #await blocks
        transforms.push([startEnd, snippetBlock.end]);
        component.addProp(
            [[snippetBlock.expression.start, snippetBlock.expression.end]],
            transforms
        );
    } else {
        let generic = '';
        if (snippetBlock.parameters?.length) {
            generic = `<[${snippetBlock.parameters
                .map((p) => {
                    let typeAnnotation = p.typeAnnotation;
                    if (!typeAnnotation && p.type === 'AssignmentPattern') {
                        typeAnnotation = p.left?.typeAnnotation;
                        if (!typeAnnotation) {
                            typeAnnotation = p.right?.typeAnnotation;
                        }
                    }
                    if (!typeAnnotation) return 'any';
                    return typeAnnotation.typeAnnotation
                        ? str.original.slice(
                              typeAnnotation.typeAnnotation.start,
                              typeAnnotation.typeAnnotation.end
                          )
                        : // slap any on to it to silence "implicit any" errors; JSDoc people can't add types to snippets
                          'any';
                })
                .join(', ')}]>`;
        }

        const typeAnnotation = surroundWithIgnoreComments(`: import('svelte').Snippet${generic}`);
        const transforms: TransformationArray = [
            'var ',
            [snippetBlock.expression.start, snippetBlock.expression.end],
            typeAnnotation + ' = ('
        ];

        if (snippetBlock.parameters?.length) {
            const start = snippetBlock.parameters[0].start;
            const end = lastParameter.typeAnnotation?.end ?? lastParameter.end;
            transforms.push([start, end]);
        }

        transforms.push(') => {async () => {'); // inner async function for potential #await blocks
        transform(str, snippetBlock.start, startEnd, startEnd, transforms);
    }
}

export function handleImplicitChildren(componentNode: BaseNode, component: InlineComponent): void {
    if (componentNode.children?.length === 0) {
        return;
    }

    let hasSlot = false;

    for (const child of componentNode.children) {
        if (
            child.type === 'SvelteSelf' ||
            child.type === 'InlineComponent' ||
            child.type === 'Element' ||
            child.type === 'SlotTemplate'
        ) {
            if (
                child.attributes.some(
                    (a) =>
                        a.type === 'Attribute' &&
                        a.name === 'slot' &&
                        a.value[0]?.data !== 'default'
                )
            ) {
                continue;
            }
        }
        if (child.type === 'Comment' || (child.type === 'Text' && child.data.trim() === '')) {
            continue;
        }
        if (child.type !== 'SnippetBlock') {
            hasSlot = true;
            break;
        }
    }

    if (!hasSlot) {
        return;
    }

    // it's enough to fake a children prop, we don't need to actually move the content inside (which would also reset control flow)
    component.addProp(['children'], ['() => { return __sveltets_2_any(0); }']);
}
