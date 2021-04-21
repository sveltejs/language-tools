import { BaseNode } from 'estree';
import { walk } from 'svelte/compiler';
import { Position } from 'vscode-languageserver-types';
import { Document, offsetAt } from '../../../lib/documents';
import { SvelteDocument } from '../SvelteDocument';
import { inStyleOrScript } from '../utils';

export async function getDocumentHighlight(
    document: Document,
    svelteDoc: SvelteDocument,
    position: Position
) {
    if (inStyleOrScript(svelteDoc, position)) {
        return null;
    }

    const {
        ast: { html }
    } = await svelteDoc.getCompiled();
    const transpiled = await svelteDoc.getTranspiled();
    const content = transpiled.getText();
    const offset = offsetAt(transpiled.getGeneratedPosition(position), content);

    walk(html, {
        enter(node: BaseNode, parent: BaseNode) {
            if (
                !(
                    node.type.includes('Block') &&
                    node.start &&
                    node.end &&
                    node.start > offset &&
                    node.end < offset
                )
            ) {
                this.skip();
                return;
            }

            switch (node.type) {
                case 'AwaitBlock':
                    node.
                    break;

                default:
                    break;
            }
        }
    });
}
