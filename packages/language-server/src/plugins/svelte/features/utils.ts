import { Position } from 'vscode-languageserver';
import { isInTag } from '../../../lib/documents';
import { AttributeContext } from '../../../lib/documents/parseHtml';
import { possiblyComponent } from '../../../utils';
import { SvelteDocument } from '../SvelteDocument';

export function attributeCanHaveEventModifier(attributeContext: AttributeContext) {
    return (
        !attributeContext.inValue &&
        !possiblyComponent(attributeContext.elementTag) &&
        attributeContext.name.startsWith('on:') &&
        attributeContext.name.includes('|')
    );
}

export function inStyleOrScript(svelteDoc: SvelteDocument, position: Position) {
    return (
        isInTag(position, svelteDoc.style) ||
        isInTag(position, svelteDoc.script) ||
        isInTag(position, svelteDoc.moduleScript)
    );
}
