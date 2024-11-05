import { BaseNode, walk } from 'estree-walker';
import { EOL } from 'os';
// @ts-ignore
import { TemplateNode } from 'svelte/types/compiler/interfaces';
import {
    CodeAction,
    CodeActionKind,
    Diagnostic,
    DiagnosticSeverity,
    OptionalVersionedTextDocumentIdentifier,
    Position,
    TextDocumentEdit,
    TextEdit
} from 'vscode-languageserver';
import {
    getLineOffsets,
    mapObjWithRangeToOriginal,
    offsetAt,
    positionAt
} from '../../../../lib/documents';
import { getIndent, pathToUrl } from '../../../../utils';
import { ITranspiledSvelteDocument, SvelteDocument } from '../../SvelteDocument';
import ts from 'typescript';
// estree does not have start/end in their public Node interface,
// but the AST returned by svelte/compiler does. Type as any as a workaround.
type Node = any;

type Ast = Awaited<ReturnType<SvelteDocument['getCompiled']>>['ast'];

/**
 * Get applicable quick fixes.
 */
export async function getQuickfixActions(
    svelteDoc: SvelteDocument,
    svelteDiagnostics: Diagnostic[]
): Promise<CodeAction[]> {
    const textDocument = OptionalVersionedTextDocumentIdentifier.create(
        pathToUrl(svelteDoc.getFilePath()),
        null
    );

    const { ast } = await svelteDoc.getCompiled();
    const transpiled = await svelteDoc.getTranspiled();
    const content = transpiled.getText();
    const lineOffsets = getLineOffsets(content);

    const codeActions: CodeAction[] = [];

    for (const diagnostic of svelteDiagnostics) {
        codeActions.push(
            ...(await createQuickfixActions(
                textDocument,
                transpiled,
                content,
                lineOffsets,
                ast,
                diagnostic
            ))
        );
    }

    return codeActions;
}

async function createQuickfixActions(
    textDocument: OptionalVersionedTextDocumentIdentifier,
    transpiled: ITranspiledSvelteDocument,
    content: string,
    lineOffsets: number[],
    ast: Ast,
    diagnostic: Diagnostic
): Promise<CodeAction[]> {
    const {
        range: { start, end }
    } = diagnostic;
    const generatedStart = transpiled.getGeneratedPosition(start);
    const generatedEnd = transpiled.getGeneratedPosition(end);
    const diagnosticStartOffset = offsetAt(generatedStart, content, lineOffsets);
    const diagnosticEndOffset = offsetAt(generatedEnd, content, lineOffsets);
    const offsetRange: ts.TextRange = {
        pos: diagnosticStartOffset,
        end: diagnosticEndOffset
    };
    const { html, instance, module } = ast;
    const tree = [html, instance, module].find((part) => {
        return (
            part?.start != null &&
            offsetRange.pos >= part.start &&
            part?.end != null &&
            offsetRange.pos <= part.end &&
            part?.end != null &&
            offsetRange.end <= part.end &&
            part?.start != null &&
            offsetRange.end >= part.start
        );
    });

    const node = findTagForRange(tree!, offsetRange, tree === html);

    const codeActions: CodeAction[] = [];

    if (diagnostic.code == 'security-anchor-rel-noreferrer') {
        codeActions.push(
            createSvelteAnchorMissingAttributeQuickfixAction(
                textDocument,
                transpiled,
                content,
                lineOffsets,
                node
            )
        );
    }

    codeActions.push(
        createSvelteIgnoreQuickfixAction(
            textDocument,
            transpiled,
            content,
            lineOffsets,
            node,
            diagnostic,
            tree === html
        )
    );

    return codeActions;
}
function createSvelteAnchorMissingAttributeQuickfixAction(
    textDocument: OptionalVersionedTextDocumentIdentifier,
    transpiled: ITranspiledSvelteDocument,
    content: string,
    lineOffsets: number[],
    node: Node
): CodeAction {
    // Assert non-null because the node target attribute is required for 'security-anchor-rel-noreferrer'
    const targetAttribute = node.attributes.find((i: any) => i.name == 'target')!;
    const relAttribute = node.attributes.find((i: any) => i.name == 'rel');

    const codeActionTextEdit = relAttribute
        ? TextEdit.insert(positionAt(relAttribute.end - 1, content, lineOffsets), ' noreferrer')
        : TextEdit.insert(
              positionAt(targetAttribute.end, content, lineOffsets),
              ' rel="noreferrer"'
          );

    return CodeAction.create(
        '(svelte) Add missing attribute rel="noreferrer"',
        {
            documentChanges: [
                TextDocumentEdit.create(textDocument, [
                    mapObjWithRangeToOriginal(transpiled, codeActionTextEdit)
                ])
            ]
        },
        CodeActionKind.QuickFix
    );
}

function createSvelteIgnoreQuickfixAction(
    textDocument: OptionalVersionedTextDocumentIdentifier,
    transpiled: ITranspiledSvelteDocument,
    content: string,
    lineOffsets: number[],
    node: Node,
    diagnostic: Diagnostic,
    isHtml: boolean
): CodeAction {
    return CodeAction.create(
        getCodeActionTitle(diagnostic),
        {
            documentChanges: [
                TextDocumentEdit.create(textDocument, [
                    getSvelteIgnoreEdit(transpiled, content, lineOffsets, node, diagnostic, isHtml)
                ])
            ]
        },
        CodeActionKind.QuickFix
    );
}

function getCodeActionTitle(diagnostic: Diagnostic) {
    // make it distinguishable with eslint's code action
    return `(svelte) Disable ${diagnostic.code} for this line`;
}

/**
 * Whether or not the given diagnostic can be ignored via a
 * <!-- svelte-ignore <code> -->
 */
export function isIgnorableSvelteDiagnostic(diagnostic: Diagnostic) {
    const { source, severity, code } = diagnostic;
    return (
        code &&
        !nonIgnorableWarnings.includes(<string>code) &&
        source === 'svelte' &&
        severity !== DiagnosticSeverity.Error
    );
}
const nonIgnorableWarnings = [
    'missing-custom-element-compile-options',
    'unused-export-let',
    'css-unused-selector'
];

function getSvelteIgnoreEdit(
    transpiled: ITranspiledSvelteDocument,
    content: string,
    lineOffsets: number[],
    node: Node,
    diagnostic: Diagnostic,
    isHtml: boolean
) {
    const { code } = diagnostic;

    const nodeStartPosition = positionAt(node.start, content, lineOffsets);
    const nodeLineStart = offsetAt(
        {
            line: nodeStartPosition.line,
            character: 0
        },
        content,
        lineOffsets
    );
    const afterStartLineStart = content.slice(nodeLineStart);
    const indent = getIndent(afterStartLineStart);

    // TODO: Make all code action's new line consistent
    let ignore = `${indent}// svelte-ignore ${code}${EOL}${indent}`;
    if (isHtml) {
        ignore = `${indent}<!-- svelte-ignore ${code} -->${EOL}`;
    }
    const position = Position.create(nodeStartPosition.line, 0);

    return mapObjWithRangeToOriginal(transpiled, TextEdit.insert(position, ignore));
}

const elementOrComponent = ['Component', 'Element', 'InlineComponent'];

function findTagForRange(ast: BaseNode, range: ts.TextRange, isHtml: boolean) {
    let nearest: BaseNode = ast;

    walk(ast, {
        enter(node, parent) {
            if (isHtml) {
                const { type } = node;
                const isBlock = 'block' in node || node.type.toLowerCase().includes('block');
                const isFragment = type === 'Fragment';
                const keepLooking = isFragment || elementOrComponent.includes(type) || isBlock;
                if (!keepLooking) {
                    this.skip();
                    return;
                }
            }

            if (within(node, range) && parent === nearest) {
                nearest = node;
            }
        }
    });

    return nearest;
}

function within(node: Node, range: ts.TextRange) {
    return node.end >= range.end && node.start <= range.pos;
}
