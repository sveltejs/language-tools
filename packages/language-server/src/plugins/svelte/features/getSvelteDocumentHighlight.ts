import { DocumentHighlight, DocumentHighlightKind, Position, Range } from 'vscode-languageserver';
import { Document, inStyleOrScript } from '../../../lib/documents';
import { SvelteNodeWalker, walkSvelteAst } from './svelte-ast-utils';
// @ts-ignore
import { TemplateNode } from 'svelte/types/compiler/interfaces';

type RangeTupleArray = Array<[start: number, end: number]>;

export interface SvelteAstWalkerProvider {
    walkSvelteAst(walker: SvelteNodeWalker): void;
}

/**
 * Highlights for Svelte template syntax:
 * - block keywords (`{#if}`/`{:else if}`/`{:else}`/`{/if}`, `{#each}`/`{:else}`/`{/each}`, `{#await}`/`{:then}`/`{:catch}`/`{/await}`, ...)
 * - tag keywords (`{@html}`, `{@const}`, ...)
 *
 * Shared between the TS6 `DocumentHighlightProvider` (which walks the svelte2tsx AST of the snapshot)
 * and the Svelte plugin in content mapper mode (which walks a template-only parse).
 */
export function getSvelteDocumentHighlight(
    document: Document,
    ast: SvelteAstWalkerProvider,
    position: Position
): DocumentHighlight[] | null {
    if (inStyleOrScript(document, position)) {
        return null;
    }

    const offset = document.offsetAt(position);

    const offsetStart = Math.max(offset - 10, 0);
    const charactersAroundOffset = document
        .getText()
        // use last 10 and next 10 characters, should cover 99% of all cases
        .substr(offsetStart, 20);

    if (
        !['#', '/', ':', '@', 'then', 'catch'].some((keyword) =>
            charactersAroundOffset.includes(keyword)
        )
    ) {
        return null;
    }

    const candidate = findCandidateSvelteTag(ast, offset);

    if (!candidate) {
        return null;
    }

    if (candidate.type.endsWith('Tag')) {
        return getTagHighlight(offset, document, candidate);
    }

    if (candidate.type.endsWith('Block')) {
        return getBlockHighlight(offset, document, candidate);
    }

    return null;
}

function findCandidateSvelteTag(ast: SvelteAstWalkerProvider, offset: number) {
    let candidate: TemplateNode | undefined;
    const subBlocks = ['ThenBlock', 'CatchBlock', 'PendingBlock', 'ElseBlock'];

    ast.walkSvelteAst({
        enter(node, parent, key) {
            if (node.type === 'Fragment') {
                return;
            }

            const templateNode = node as TemplateNode;
            const isWithin = templateNode.start <= offset && templateNode.end >= offset;

            const canSkip =
                !isWithin ||
                key === 'expression' ||
                key === 'context' ||
                ((parent.type === 'InlineComponent' || parent.type === 'Element') &&
                    key !== 'children');

            if (canSkip) {
                this.skip();
                return;
            }

            if (node.type.endsWith('Tag')) {
                candidate = templateNode;
                return;
            }

            // don't use sub-blocks so we can highlight the whole block
            if (node.type.endsWith('Block') && !subBlocks.includes(node.type)) {
                if (
                    // else if
                    node.type === 'IfBlock' &&
                    parent.type === 'ElseBlock' &&
                    parent.start === node.start
                ) {
                    return;
                }
                candidate = templateNode;
                return;
            }
        }
    });

    return candidate;
}

function getTagHighlight(
    offset: number,
    document: Document,
    candidate: TemplateNode
): DocumentHighlight[] | null {
    const name =
        candidate.type === 'RawMustacheTag'
            ? 'html'
            : candidate.type.replace('Tag', '').toLocaleLowerCase();

    const startTag = '@' + name;
    const indexOfName = document.getText().indexOf(startTag, candidate.start);

    if (indexOfName < 0 || indexOfName > offset || candidate.start + startTag.length < offset) {
        return null;
    }

    return [
        {
            kind: DocumentHighlightKind.Read,
            range: Range.create(
                document.positionAt(indexOfName),
                document.positionAt(indexOfName + startTag.length)
            )
        }
    ];
}

function getBlockHighlight(
    offset: number,
    document: Document,
    candidate: TemplateNode
): DocumentHighlight[] | null {
    const name = candidate.type.replace('Block', '').toLowerCase();

    const startTag = '#' + name;
    const startTagStart = document.getText().indexOf(startTag, candidate.start);

    if (startTagStart < 0) {
        return null;
    }

    const ranges: RangeTupleArray = [];

    ranges.push([startTagStart, startTagStart + startTag.length]);

    const content = document.getText();
    const endTag = '/' + name;
    const endTagStart = content.lastIndexOf(endTag, candidate.end);

    if (endTagStart < startTagStart) {
        return null; // can happen in loose parser mode for unclosed tags
    }

    ranges.push([endTagStart, endTagStart + endTag.length]);

    if (candidate.type === 'EachBlock' && candidate.else) {
        const elseStart = content.lastIndexOf(':else', candidate.else.start);

        ranges.push([elseStart, elseStart + ':else'.length]);
    }

    ranges.push(
        ...getElseHighlightsForIfBlock(candidate, content),
        ...getAwaitBlockHighlight(candidate, content)
    );

    if (!ranges.some(([start, end]) => offset >= start && offset <= end)) {
        return null;
    }

    return ranges.map(([start, end]) => ({
        range: Range.create(document.positionAt(start), document.positionAt(end)),
        kind: DocumentHighlightKind.Read
    }));
}

function getElseHighlightsForIfBlock(candidate: TemplateNode, content: string): RangeTupleArray {
    if (candidate.type !== 'IfBlock' || !candidate.else) {
        return [];
    }

    const ranges = new Map<number, RangeTupleArray[number]>();

    walkSvelteAst(candidate.else, {
        enter(node) {
            const templateNode = node as TemplateNode;
            if (templateNode.type === 'IfBlock' && templateNode.elseif) {
                const elseIfStart = content.lastIndexOf(':else if', templateNode.expression.start);

                if (elseIfStart > 0) {
                    ranges.set(elseIfStart, [elseIfStart, elseIfStart + ':else if'.length]);
                }
            }

            if (templateNode.type === 'ElseBlock') {
                const elseStart = content.lastIndexOf(':else', templateNode.start);

                if (
                    elseStart > 0 &&
                    content.slice(elseStart, elseStart + ':else if'.length) !== ':else if'
                ) {
                    ranges.set(elseStart, [elseStart, elseStart + ':else'.length]);
                }
            }
        }
    });

    return Array.from(ranges.values());
}

function getAwaitBlockHighlight(candidate: TemplateNode, content: string): RangeTupleArray {
    if (candidate.type !== 'AwaitBlock' || (candidate.then.skip && candidate.catch.skip)) {
        return [];
    }

    const ranges: RangeTupleArray = [];

    if (candidate.value) {
        const thenKeyword = candidate.pending.skip ? 'then' : ':then';

        const thenStart = content.lastIndexOf(thenKeyword, candidate.value.start);

        ranges.push([thenStart, thenStart + thenKeyword.length]);
    }

    // {#await promise catch error} or {:catch error}
    if (candidate.error) {
        const catchKeyword = candidate.pending.skip && candidate.then.skip ? 'catch' : ':catch';

        const catchStart = content.lastIndexOf(catchKeyword, candidate.error.start);

        ranges.push([catchStart, catchStart + catchKeyword.length]);
    } else if (!candidate.catch.skip) {
        // {:catch}

        const catchStart = content.indexOf(':catch', candidate.catch.start);

        ranges.push([catchStart, catchStart + ':catch'.length]);
    }

    return ranges;
}
