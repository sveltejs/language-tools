import { walk } from 'estree-walker';
import { EOL } from 'os';
import { Ast } from 'svelte/types/compiler/interfaces';
import {
    CodeAction,
    CodeActionKind,
    Diagnostic,
    DiagnosticSeverity,
    Position,
    TextDocumentEdit,
    TextEdit,
    VersionedTextDocumentIdentifier,
} from 'vscode-languageserver';
import { mapTextEditToOriginal, offsetAt, positionAt } from '../../../../lib/documents';
import { pathToUrl } from '../../../../utils';
import { SvelteDocument } from '../../SvelteDocument';
import ts from 'typescript';
// There are multiple estree-walker versions in the monorepo.
// The newer versions don't have start/end in their public interface,
// but the AST returned by svelte/compiler does.
// To get the Node type right in both dev and prod environment,
// declaring the Node type like this is necessary. Once
// all depend on the same estree(-walker) version, this should be revisited.
type Node = any;

/**
 * Get applicable quick fixes.
 */
export async function getQuickfixActions(
    svelteDoc: SvelteDocument,
    svelteDiagnostics: Diagnostic[],
) {
    const { ast } = await svelteDoc.getCompiled();

    return Promise.all(
        svelteDiagnostics.map(
            async (diagnostic) => await createQuickfixAction(diagnostic, svelteDoc, ast),
        ),
    );
}

async function createQuickfixAction(
    diagnostic: Diagnostic,
    svelteDoc: SvelteDocument,
    ast: Ast,
): Promise<CodeAction> {
    const textDocument = VersionedTextDocumentIdentifier.create(
        pathToUrl(svelteDoc.getFilePath()),
        svelteDoc.version,
    );

    return CodeAction.create(
        getCodeActionTitle(diagnostic),
        {
            documentChanges: [
                TextDocumentEdit.create(textDocument, [
                    await getSvelteIgnoreEdit(svelteDoc, ast, diagnostic),
                ]),
            ],
        },
        CodeActionKind.QuickFix,
    );
}

function getCodeActionTitle(diagnostic: Diagnostic) {
    // make it distinguishable with eslint's code action
    return `(svelte) Disable ${diagnostic.code} for this line`;
}

export function isIgnorableSvelteDiagnostic(diagnostic: Diagnostic) {
    const { source, severity, code } = diagnostic;
    return code && source === 'svelte' && severity !== DiagnosticSeverity.Error;
}

async function getSvelteIgnoreEdit(svelteDoc: SvelteDocument, ast: Ast, diagnostic: Diagnostic) {
    const {
        code,
        range: { start, end },
    } = diagnostic;
    const transpiled = await svelteDoc.getTranspiled();
    const content = transpiled.getText();
    const { html } = ast;

    const diagnosticStartOffset = offsetAt(start, transpiled.getText());
    const diagnosticEndOffset = offsetAt(end, transpiled.getText());
    const offsetRange: ts.TextRange = {
        pos: diagnosticStartOffset,
        end: diagnosticEndOffset,
    };

    const node = findTagForRange(html, offsetRange);

    const nodeStartPosition = positionAt(node.start, content);
    const nodeLineStart = offsetAt(
        {
            line: nodeStartPosition.line,
            character: 0,
        },
        transpiled.getText(),
    );
    const afterStartLineStart = content.slice(nodeLineStart);
    const indent = /^[ |\t]+/.exec(afterStartLineStart)?.[0] ?? '';

    // TODO: Make all code action's new line consistent
    const ignore = `${indent}<!-- svelte-ignore ${code} -->${EOL}`;
    const position = Position.create(nodeStartPosition.line, 0);

    return mapTextEditToOriginal(transpiled, TextEdit.insert(position, ignore));
}

const elementOrComponent = ['Component', 'Element', 'InlineComponent'];

function findTagForRange(html: Node, range: ts.TextRange) {
    let nearest = html;

    walk(html, {
        enter(node, parent) {
            const { type } = node;
            const isBlock = 'block' in node || node.type.toLowerCase().includes('block');
            const isFragment = type === 'Fragment';
            const keepLooking = isFragment || elementOrComponent.includes(type) || isBlock;
            if (!keepLooking) {
                this.skip();
                return;
            }

            if (within(node, range) && parent === nearest) {
                nearest = node;
            }
        },
    });

    return nearest;
}

function within(node: Node, range: ts.TextRange) {
    return node.end >= range.end && node.start <= range.pos;
}
