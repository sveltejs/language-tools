import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import ts from 'typescript';
import { ImplicitStoreValues } from './nodes/ImplicitStoreValues';
import { handleTypeAssertion } from './nodes/handleTypeAssertion';
import { Generics } from './nodes/Generics';

export function processModuleScriptTag(
    str: MagicString,
    script: Node,
    implicitStoreValues: ImplicitStoreValues
) {
    const htmlx = str.original;
    const scriptContent = htmlx.substring(script.content.start, script.content.end);
    const tsAst = ts.createSourceFile(
        'component.module.ts.svelte',
        scriptContent,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );
    const astOffset = script.content.start;

    const generics = new Generics(str, astOffset);

    const walk = (node: ts.Node) => {
        resolveImplicitStoreValue(node, implicitStoreValues, str, astOffset);

        generics.throwIfIsGeneric(node);

        ts.forEachChild(node, (n) => walk(n));
    };

    //walk the ast and convert to tsx as we go
    tsAst.forEachChild((n) => walk(n));

    // declare store declarations we found in the script
    implicitStoreValues.modifyCode(astOffset, str);

    const scriptStartTagEnd = htmlx.indexOf('>', script.start) + 1;
    const scriptEndTagStart = htmlx.lastIndexOf('<', script.end - 1);

    str.overwrite(script.start, scriptStartTagEnd, '</>;');
    str.overwrite(scriptEndTagStart, script.end, ';<>');
}

function resolveImplicitStoreValue(
    node: ts.Node,
    implicitStoreValues: ImplicitStoreValues,
    str: MagicString,
    astOffset: any
) {
    if (ts.isVariableDeclaration(node)) {
        implicitStoreValues.addVariableDeclaration(node);
    }

    if (ts.isImportClause(node)) {
        implicitStoreValues.addImportStatement(node);
    }

    if (ts.isImportSpecifier(node)) {
        implicitStoreValues.addImportStatement(node);
    }

    if (ts.isTypeAssertionExpression?.(node)) {
        handleTypeAssertion(str, node, astOffset);
    }
}
