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

    const nearest = findNearestSvelteTag(html, offset);

    if (!nearest) {
        return null;
    }

    if (nearest.type.endsWith('Tag')) {
        return (
            getTagHighlight(offset, content, nearest)?.map((highlight) =>
                mapObjWithRangeToOriginal(transpiled, highlight)
            ) ?? null
        );
    }

    if (nearest.type.endsWith('Block')) {
        return (
            getBlockHighlight(offset, content, nearest)?.map((highlight) =>
                mapObjWithRangeToOriginal(transpiled, highlight)
            ) ?? null
        );
    }

    return null;
}

function findNearestSvelteTag(html: TemplateNode, offset: number) {
    let nearest: TemplateNode | undefined;
    const independentBlocks = ['EachBlock', 'IfBlock', 'AwaitBlock', 'KeyBlock'];

    walk(html, {
        enter(node, parent, key) {
            if (node.type === 'Fragment') {
                return;
            }

            const templateNode = node as TemplateNode;
            const isWithin = templateNode.start <= offset && templateNode.end >= offset;
            if (!isWithin) {
                this.skip();
                return;
            }

            if (
                (node.type.endsWith('Block') && independentBlocks.includes(node.type)) ||
                node.type.endsWith('Tag')
            ) {
                nearest = templateNode;
                return;
            }

            if (key === 'attributes') {
                this.skip();
            }
        }
    });

    return nearest;
}

function getTagHighlight(
    offset: number,
    content: string,
    nearest: TemplateNode
): DocumentHighlight[] | null {
    const name =
        nearest.type === 'RawMustacheTag'
            ? 'html'
            : nearest.type.replace('Tag', '').toLocaleLowerCase();

    const startTag = '@' + name;
    const indexOfName = content.indexOf(startTag, nearest.start);

    if (indexOfName < 0 || indexOfName > offset || nearest.start + startTag.length < offset) {
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
    nearest: TemplateNode
): DocumentHighlight[] | null {
    const name = nearest.type.replace('Block', '').toLowerCase();

    const startTag = '#' + name;
    const startTagStart = content.indexOf(startTag, nearest.start);

    if (startTagStart < 0) {
        return null;
    }

    const ranges: Array<[start: number, end: number]> = [];

    ranges.push([startTagStart, startTagStart + startTag.length]);

    const endTag = '/' + name;
    const endTagStart = content.lastIndexOf(endTag, nearest.end);

    ranges.push([endTagStart, endTagStart + endTag.length]);

    if (nearest.type === 'EachBlock' && nearest.else) {
        const elseStart = content.lastIndexOf(':else', nearest.else.start);

        ranges.push([elseStart, elseStart + ':else'.length]);
    }

    if (!ranges.some(([start, end]) => offset >= start && offset <= end)) {
        return null;
    }

    return ranges.map(([start, end]) => ({
        range: Range.create(positionAt(start, content), positionAt(end, content)),
        kind: DocumentHighlightKind.Read
    }));
}
