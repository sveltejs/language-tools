import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import type ts from 'typescript';
import type { TsFacade } from '../facade';
import { ImplicitStoreValues } from './nodes/ImplicitStoreValues';
import { handleTypeAssertion } from './nodes/handleTypeAssertion';
import { Generics } from './nodes/Generics';
import { is$$EventsDeclaration } from './nodes/ComponentEvents';
import { throwError } from './utils/error';
import { is$$SlotsDeclaration } from './nodes/slot';
import { is$$PropsDeclaration } from './nodes/ExportedNames';
import {
    rewriteExternalImportsInNode,
    RewriteExternalImportsOptions
} from '../helpers/rewriteExternalImports';

export interface ModuleAst {
    htmlx: string;
    tsAst: ts.SourceFile;
    astOffset: number;
}

export function createModuleAst(ts: TsFacade, str: MagicString, script: Node): ModuleAst {
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

    return { htmlx, tsAst, astOffset };
}

export function processModuleScriptTag(
    ts: TsFacade,
    str: MagicString,
    script: Node,
    implicitStoreValues: ImplicitStoreValues,
    moduleAst: ModuleAst,
    rewriteExternalImports?: RewriteExternalImportsOptions
) {
    const { htmlx, tsAst, astOffset } = moduleAst;

    const generics = new Generics(ts, str, astOffset, script);
    if (generics.genericsAttr) {
        const start = htmlx.indexOf('generics', script.start);
        throwError(
            start,
            start + 8,
            'The generics attribute is only allowed on the instance script',
            str.original
        );
    }

    const walk = (node: ts.Node) => {
        if (rewriteExternalImports) {
            rewriteExternalImportsInNode(ts, node, rewriteExternalImports, (specifier, rewrite) => {
                str.overwrite(
                    specifier.getStart(tsAst) + astOffset + 1,
                    specifier.getEnd() + astOffset - 1,
                    rewrite.rewritten
                );
            });
        }

        resolveImplicitStoreValue(ts, node, implicitStoreValues, str, astOffset);

        generics.throwIfIsGeneric(node);
        throwIfIs$$EventsDeclaration(ts, node, str, astOffset);
        throwIfIs$$SlotsDeclaration(ts, node, str, astOffset);
        throwIfIs$$PropsDeclaration(ts, node, str, astOffset);

        ts.forEachChild(node, (n) => walk(n));
    };

    //walk the ast and convert to tsx as we go
    tsAst.forEachChild((n) => walk(n));

    // declare store declarations we found in the script
    implicitStoreValues.modifyCode(astOffset, str);

    const scriptStartTagEnd = htmlx.indexOf('>', script.start) + 1;
    const scriptEndTagStart = htmlx.lastIndexOf('<', script.end - 1);

    str.overwrite(script.start, scriptStartTagEnd, ';', {
        contentOnly: true
    });
    str.overwrite(scriptEndTagStart, script.end, ';', {
        contentOnly: true
    });
}

function resolveImplicitStoreValue(
    ts: TsFacade,
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

function throwIfIs$$EventsDeclaration(
    ts: TsFacade,
    node: ts.Node,
    str: MagicString,
    astOffset: number
) {
    if (is$$EventsDeclaration(ts, node)) {
        throw$$Error(node, str, astOffset, '$$Events');
    }
}

function throwIfIs$$SlotsDeclaration(
    ts: TsFacade,
    node: ts.Node,
    str: MagicString,
    astOffset: number
) {
    if (is$$SlotsDeclaration(ts, node)) {
        throw$$Error(node, str, astOffset, '$$Slots');
    }
}

function throwIfIs$$PropsDeclaration(
    ts: TsFacade,
    node: ts.Node,
    str: MagicString,
    astOffset: number
) {
    if (is$$PropsDeclaration(ts, node)) {
        throw$$Error(node, str, astOffset, '$$Props');
    }
}

function throw$$Error(node: ts.Node, str: MagicString, astOffset: number, type: string) {
    throwError(
        node.getStart() + astOffset,
        node.getEnd() + astOffset,
        `${type} can only be declared in the instance script`,
        str.original
    );
}
