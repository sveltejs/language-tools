import { Node } from 'estree-walker';
import { BaseDirective, SvelteIdentifier } from '../interfaces';
import TemplateScope from './TemplateScope';
import { SlotHandler } from './slot';
import { isIdentifier, isDestructuringPatterns } from '../utils/svelteAst';
import { extract_identifiers as extractIdentifiers } from 'periscopic';

export function handleScopeAndResolveForSlot({
    identifierDef,
    initExpression,
    owner,
    slotHandler,
    templateScope,
}: {
    identifierDef: Node;
    initExpression: Node;
    owner: Node;
    slotHandler: SlotHandler;
    templateScope: TemplateScope;
}) {
    if (isIdentifier(identifierDef)) {
        templateScope.add(identifierDef, owner);

        slotHandler.resolve(identifierDef, initExpression, templateScope);
    }
    if (isDestructuringPatterns(identifierDef)) {
        const identifiers = extractIdentifiers(identifierDef) as SvelteIdentifier[];
        templateScope.addMany(identifiers, owner);

        slotHandler.resolveDestructuringAssignment(
            identifierDef,
            identifiers,
            initExpression,
            templateScope,
        );
    }
}

export function handleScopeAndResolveLetVarForSlotFor({
    letNode,
    component,
    slotName,
    templateScope,
    slotHandler,
}: {
    letNode: BaseDirective;
    slotName: string;
    component: Node;
    templateScope: TemplateScope;
    slotHandler: SlotHandler;
}) {
    const { expression } = letNode;
    // <Component let:a>
    if (!expression) {
        templateScope.add(letNode, component);
        slotHandler.resolveLet(letNode, letNode, component, slotName);
    } else {
        if (isIdentifier(expression)) {
            templateScope.add(expression, component);
            slotHandler.resolveLet(letNode, expression, component, slotName);
        }
        const expForExtract = { ...expression };

        // https://github.com/sveltejs/svelte/blob/3a37de364bfbe75202d8e9fcef9e76b9ce6faaa2/src/compiler/compile/nodes/Let.ts#L37
        if (expression.type === 'ArrayExpression') {
            expForExtract.type = 'ArrayPattern';
        } else if (expression.type === 'ObjectExpression') {
            expForExtract.type = 'ObjectPattern';
        }
        if (isDestructuringPatterns(expForExtract)) {
            // the node object is returned as-it no mutation
            const identifiers = extractIdentifiers(expForExtract) as SvelteIdentifier[];
            templateScope.addMany(identifiers, component);

            slotHandler.resolveDestructuringAssignmentForLet(
                expForExtract,
                identifiers,
                letNode,
                component,
                slotName,
            );
        }
    }
}
