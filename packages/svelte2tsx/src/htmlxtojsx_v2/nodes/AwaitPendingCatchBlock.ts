import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { withTrailingPropertyAccess, transform, TransformationArray } from '../utils/node-utils';

/**
 * This needs to be called on the way out, not on the way on, when walking,
 * because else the order of moves might get messed up with moves in
 * the children.
 *
 * The await block consists of these blocks:
 *- expression: the promise - has start and end
 *- value: the result of the promise - has start and end
 *- error: the error branch value - has start and end
 *- pending: start/end of the pending block (if exists), with skip boolean
 *- then: start/end of the then block (if exists), with skip boolean
 *- catch: start/end of the catch block (if exists), with skip boolean
 *
 * Implementation note:
 * As soon there's a `then` with a value, we transform that to
 * `{const $$_value = foo; {const foo = await $$_value;..}}` because
 *
 * - `{#await foo then foo}` or `{#await foo}..{:then foo}..` is valid Svelte code
 * - `{#await foo} {bar} {:then bar} {bar} {/await} is valid Svelte code`
 *
 *  Both would throw "variable used before declaration" if we didn't do the
 * transformation this way.
 */
export function handleAwait(str: MagicString, awaitBlock: BaseNode): void {
    const transforms: TransformationArray = ['{ '];
    if (!awaitBlock.pending.skip) {
        transforms.push([awaitBlock.pending.start, awaitBlock.pending.end]);
    }
    if (awaitBlock.error || !awaitBlock.catch.skip) {
        transforms.push('try { ');
    }
    if (awaitBlock.value) {
        transforms.push('const $$_value = ');
    }

    const expressionEnd = withTrailingPropertyAccess(str.original, awaitBlock.expression.end);
    transforms.push('await (', [awaitBlock.expression.start, expressionEnd], ');');

    if (awaitBlock.value) {
        const end = awaitBlock.value.typeAnnotation?.end ?? awaitBlock.value.end;
        transforms.push('{ const ', [awaitBlock.value.start, end], ' = $$_value; ');
    }
    if (!awaitBlock.then.skip) {
        if (awaitBlock.pending.skip) {
            transforms.push([awaitBlock.then.start, awaitBlock.then.end]);
        } else if (awaitBlock.then.children?.length) {
            transforms.push([
                awaitBlock.then.children[0].start,
                awaitBlock.then.children[awaitBlock.then.children.length - 1].end
            ]);
        }
    }
    if (awaitBlock.value) {
        transforms.push('}');
    }
    if (awaitBlock.error || !awaitBlock.catch.skip) {
        transforms.push('} catch($$_e) { ');
        const end = awaitBlock.error?.typeAnnotation?.end ?? awaitBlock.error?.end;
        if (awaitBlock.error) {
            transforms.push('const ', [awaitBlock.error.start, end], ' = __sveltets_2_any();');
        }
        if (!awaitBlock.catch.skip && awaitBlock.catch.children?.length) {
            transforms.push([
                awaitBlock.catch.children[0].start,
                awaitBlock.catch.children[awaitBlock.catch.children.length - 1].end
            ]);
        }
        transforms.push('}');
    }
    transforms.push('}');
    transform(str, awaitBlock.start, awaitBlock.end, transforms);
}
