import {
    Diagnostic,
    CodeActionContext,
    CodeAction,
    TextEdit,
    TextDocumentEdit,
    Position,
    CodeActionKind,
    VersionedTextDocumentIdentifier,
    DiagnosticSeverity,
} from 'vscode-languageserver';
import { walk } from 'estree-walker';
import { EOL } from 'os';
import { SvelteDocument } from '../SvelteDocument';
import { pathToUrl } from '../../../utils';
import { positionAt, offsetAt, mapTextEditToOriginal } from '../../../lib/documents';
import { Ast } from 'svelte/types/compiler/interfaces';
// There are multiple estree-walker versions in the monorepo.
// To get the Node type right in both dev and prod environment,
// declaring the Node type like this is necessary. Once
// all depend on the same estree(-walker) version, this should be removed.
type Node = Parameters<typeof walk>[0];

interface OffsetRange {
    start: number;
    end: number;
}

export async function getCodeActions(
    svelteDoc: SvelteDocument,
    context: CodeActionContext,
): Promise<CodeAction[]> {
    const { ast } = await svelteDoc.getCompiled();
    const svelteDiagnostics = context.diagnostics.filter(isIgnorableSvelteDiagnostic);

    return Promise.all(
        svelteDiagnostics.map(
            async (diagnostic) => await createCodeAction(diagnostic, svelteDoc, ast),
        ),
    );
}

async function createCodeAction(
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

function isIgnorableSvelteDiagnostic(diagnostic: Diagnostic) {
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
    const OffsetRange = {
        start: diagnosticStartOffset,
        end: diagnosticEndOffset,
    };

    const node = findTagForRange(html, OffsetRange);

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

function findTagForRange(html: Node, range: OffsetRange) {
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

function within(node: Node, range: OffsetRange) {
    return node.end >= range.end && node.start <= range.start;
}
