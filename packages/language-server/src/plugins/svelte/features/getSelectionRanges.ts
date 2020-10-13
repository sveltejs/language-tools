import { walk } from 'estree-walker';
import { Position, Range, SelectionRange } from 'vscode-languageserver';
import { isInTag, positionAt } from '../../../lib/documents';
import { SvelteDocument } from '../SvelteDocument';


type OffsetRange = {
    start: number;
    end: number;
};

export async function getSelectionRange(
    svelteDoc: SvelteDocument,
    position: Position,
) {
    const { script, style, moduleScript } = svelteDoc;
    const { ast: { html } } = await svelteDoc.getCompiled();
    const transpiled = await svelteDoc.getTranspiled();
    const content = transpiled.getText();
    const offset = svelteDoc.offsetAt(position);


    const embedded = [script, style, moduleScript];
    for (const info of embedded) {
        if (isInTag(position, info)) {
            // let other plugins do it
            return null;
        }
    }

    let nearest: OffsetRange = html;
    let result: SelectionRange | undefined;

    walk(html, {
        enter(node, parent) {
            if (!parent) {
                // keep looking
                return;
            }

            if (!('start' in node && 'end' in node)) {
                this.skip();
                return;
            }

            const { start, end } = node;
            const isWithin = start <= offset && end >= offset;

            if (!isWithin) {
                this.skip();
                return;
            }

            if (nearest === parent) {
                nearest = node;
                result = createSelectionRange(node, result);
            }
        },
    });

    return result ?? null;

    function createSelectionRange(node: OffsetRange, parent?: SelectionRange) {
        const range = Range.create(positionAt(node.start, content), positionAt(node.end, content));

        return SelectionRange.create(range, parent);
    }
}
