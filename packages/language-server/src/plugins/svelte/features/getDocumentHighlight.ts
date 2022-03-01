import { walk } from 'svelte/compiler';
import { TemplateNode } from 'svelte/types/compiler/interfaces';
import { Range } from 'vscode-languageserver';
import { Position, DocumentHighlight, DocumentHighlightKind } from 'vscode-languageserver-types';
import { Document, mapObjWithRangeToOriginal, offsetAt, positionAt } from '../../../lib/documents';
import { SvelteDocument } from '../SvelteDocument';
import { inStyleOrScript } from '../utils';

export async function getDocumentHighlight(
    document: Document,
    svelteDoc: SvelteDocument,
    position: Position
): Promise<DocumentHighlight[] | null> {
    if (inStyleOrScript(svelteDoc, position)) {
        return null;
    }

    const {
        ast: { html }
    } = await svelteDoc.getCompiled();
    const transpiled = await svelteDoc.getTranspiled();
    const content = transpiled.getText();
    const offset = offsetAt(transpiled.getGeneratedPosition(position), content);

    const offsetStart = Math.max(offset - 10, 0);
    const charactersAroundOffset = transpiled
        .getText()
        // use last 10 and next 10 characters, should cover 99% of all cases
        .substr(offsetStart, 20);

    if (!['#', '/', ':', '@'].some((char) => charactersAroundOffset.includes(char))) {
        return null;
    }

    const candidate = findCandidateSvelteTag(html, offset);

    if (!candidate) {
        return null;
    }

    if (candidate.type.endsWith('Tag')) {
        return (
            getTagHighlight(offset, content, candidate)?.map((highlight) =>
                mapObjWithRangeToOriginal(transpiled, highlight)
            ) ?? null
        );
    }

    if (candidate.type.endsWith('Block')) {
        return (
            getBlockHighlight(offset, content, candidate)?.map((highlight) =>
                mapObjWithRangeToOriginal(transpiled, highlight)
            ) ?? null
        );
    }

    return null;
}

function findCandidateSvelteTag(html: TemplateNode, offset: number) {
    let candidate: TemplateNode | undefined;

    walk(html, {
        enter(node, _, key) {
            if (node.type === 'Fragment') {
                return;
            }

            const templateNode = node as TemplateNode;
            const isWithin = templateNode.start <= offset && templateNode.end >= offset;
            if (!isWithin || key !== 'children') {
                this.skip();
                return;
            }

            if (node.type.endsWith('Block') || node.type.endsWith('Tag')) {
                candidate = templateNode;
                return;
            }
        }
    });

    return candidate;
}

function getTagHighlight(
    offset: number,
    content: string,
    candidate: TemplateNode
): DocumentHighlight[] | null {
    const name =
        candidate.type === 'RawMustacheTag'
            ? 'html'
            : candidate.type.replace('Tag', '').toLocaleLowerCase();

    const startTag = '@' + name;
    const indexOfName = content.indexOf(startTag, candidate.start);

    if (indexOfName < 0 || indexOfName > offset || candidate.start + startTag.length < offset) {
        return null;
    }

    return [
        {
            range: Range.create(
                positionAt(indexOfName, content),
                positionAt(indexOfName + startTag.length, content)
            )
        }
    ];
}

function getBlockHighlight(
    offset: number,
    content: string,
    candidate: TemplateNode
): DocumentHighlight[] | null {
    const name = candidate.type.replace('Block', '').toLowerCase();

    const startTag = '#' + name;
    const startTagStart = content.indexOf(startTag, candidate.start);

    if (startTagStart < 0) {
        return null;
    }

    const ranges: Array<[start: number, end: number]> = [];

    ranges.push([startTagStart, startTagStart + startTag.length]);

    const endTag = '/' + name;
    const endTagStart = content.lastIndexOf(endTag, candidate.end);

    ranges.push([endTagStart, endTagStart + endTag.length]);

    if (candidate.type === 'EachBlock' && candidate.else) {
        const elseStart = content.lastIndexOf(':else', candidate.else.start);

        ranges.push([elseStart, elseStart + ':else'.length]);
    }

    ranges.push(...gatherElseHighlightsForIfBlock(candidate, content));

    if (!ranges.some(([start, end]) => offset >= start && offset <= end)) {
        return null;
    }

    return ranges.map(([start, end]) => ({
        range: Range.create(positionAt(start, content), positionAt(end, content)),
        kind: DocumentHighlightKind.Read
    }));
}

function gatherElseHighlightsForIfBlock(
    candidate: TemplateNode,
    content: string
): Array<[start: number, end: number]> {
    if (candidate.type !== 'IfBlock' || !candidate.else) {
        return [];
    }

    const ranges: Array<[start: number, end: number]> = [];

    walk(candidate.else, {
        enter(node) {
            const templateNode = node as TemplateNode;
            if (templateNode.type === 'IfBlock' && templateNode.elseif) {
                const elseIfStart = content.lastIndexOf(':else if', templateNode.expression.start);

                if (elseIfStart > 0) {
                    ranges.push([elseIfStart, elseIfStart + ':else if'.length]);
                }
            }

            if (templateNode.type === 'ElseBlock') {
                const elseStart = content.lastIndexOf(':else', templateNode.start);

                if (elseStart > 0) {
                    ranges.push([elseStart, elseStart + ':else'.length]);
                }
            }
        }
    });

    return ranges;
}
