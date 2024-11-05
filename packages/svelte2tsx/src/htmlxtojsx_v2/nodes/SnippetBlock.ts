import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { transform, TransformationArray } from '../utils/node-utils';
import { InlineComponent } from './InlineComponent';
import { IGNORE_POSITION_COMMENT, surroundWithIgnoreComments } from '../../utils/ignore';

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
 * const foo = (bar) => { async () => {
 * ..
 * };return return __sveltets_2_any(0)};
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

    const afterSnippet = isImplicitProp
        ? `};return __sveltets_2_any(0)}`
        : `};return __sveltets_2_any(0)};`;

    str.overwrite(endSnippet, snippetBlock.end, afterSnippet, {
        contentOnly: true
    });

    const lastParameter = snippetBlock.parameters?.at(-1);

    const startEnd =
        str.original.indexOf(
            '}',
            lastParameter?.typeAnnotation?.end ?? lastParameter?.end ?? snippetBlock.expression.end
        ) + 1;

    let parameters: [number, number] | undefined;

    if (snippetBlock.parameters?.length) {
        const firstParameter = snippetBlock.parameters[0];
        const start = firstParameter?.leadingComments?.[0]?.start ?? firstParameter.start;
        const end = lastParameter.typeAnnotation?.end ?? lastParameter.end;
        parameters = [start, end];
    }

    // inner async function for potential #await blocks
    const afterParameters = ` => { async ()${IGNORE_POSITION_COMMENT} => {`;

    if (isImplicitProp) {
        str.overwrite(snippetBlock.start, snippetBlock.expression.start, '', { contentOnly: true });
        const transforms: TransformationArray = ['('];
        if (parameters) {
            transforms.push(parameters);
            const [start, end] = parameters;
            str.overwrite(snippetBlock.expression.end, start, '', {
                contentOnly: true
            });
            str.overwrite(end, startEnd, '', { contentOnly: true });
        } else {
            str.overwrite(snippetBlock.expression.end, startEnd, '', { contentOnly: true });
        }
        transforms.push(')' + afterParameters);
        transforms.push([startEnd, snippetBlock.end]);
        component.addImplicitSnippetProp(
            [snippetBlock.expression.start, snippetBlock.expression.end],
            transforms
        );
    } else {
        const transforms: TransformationArray = [
            'const ',
            [snippetBlock.expression.start, snippetBlock.expression.end],
            IGNORE_POSITION_COMMENT,
            ' = ('
        ];

        if (parameters) {
            transforms.push(parameters);
        }

        transforms.push(
            ')',
            surroundWithIgnoreComments(`: ReturnType<import('svelte').Snippet>`), // shows up nicely preserved on hover, other alternatives don't
            afterParameters
        );

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
        if (
            child.type === 'Comment' ||
            child.type === 'Slot' ||
            (child.type === 'Text' && child.data.trim() === '')
        ) {
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

export function hoistSnippetBlock(str: MagicString, blockOrEl: BaseNode) {
    if (blockOrEl.type === 'InlineComponent') {
        // implicit props, handled in InlineComponent
        return;
    }

    let targetPosition: number | undefined;

    for (const node of blockOrEl.children ?? []) {
        if (node.type !== 'SnippetBlock') {
            if (targetPosition === undefined && (node.type !== 'Text' || node.data.trim() !== '')) {
                targetPosition = node.type === 'Text' ? node.end : node.start;
            }
            continue;
        }

        // already first
        if (targetPosition === undefined) {
            continue;
        }

        if (node.start === targetPosition) {
            continue;
        }

        str.move(node.start, node.end, targetPosition);
    }
}
