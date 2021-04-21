import { Position } from 'vscode-languageserver-protocol';
import { isInTag } from '../../lib/documents';
import { SvelteDocument } from './SvelteDocument';

export function inStyleOrScript(svelteDoc: SvelteDocument, position: Position) {
    return isInTag(position, svelteDoc.style) ||
        isInTag(position, svelteDoc.script) ||
        isInTag(position, svelteDoc.moduleScript);
}
