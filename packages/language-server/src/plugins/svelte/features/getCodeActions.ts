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
import { walk, Node } from 'estree-walker';
import { EOL } from 'os';
import { SvelteDocument } from '../SvelteDocument';
import { pathToUrl } from '../../../utils';
import { positionAt } from '../../../lib/documents';
import { Ast } from 'svelte/types/compiler/interfaces';

interface OffsetRange {
    start: number;
    end: number;
}

export function getCodeActions(
    svelteDoc: SvelteDocument,
    ast: Ast,
    context: CodeActionContext
) {
    const svelteDiagnostics = context.diagnostics
        .filter(isIgnorableSvelteDiagnostic);

    return svelteDiagnostics.map(diagnostic => {
        const textDocument = VersionedTextDocumentIdentifier.create(
            pathToUrl(svelteDoc.getFilePath()),
            svelteDoc.version
        );

        return CodeAction.create(getCodeActionTitle(diagnostic), {
            documentChanges: [
                TextDocumentEdit.create(textDocument, [
                    getSvelteIgnoreEdit(svelteDoc, ast, diagnostic)
                ])
            ]
        },
            CodeActionKind.QuickFix);
    });
}

function getCodeActionTitle(diagnostic: Diagnostic) {
    // make it distinguishable with eslint's code action
    return `(svelte) Disable ${diagnostic.code} for this line`;
}

function isIgnorableSvelteDiagnostic(diagnostic: Diagnostic) {
    const { source, severity, code } = diagnostic;
    return code && source === 'svelte' &&
        severity !== DiagnosticSeverity.Error;
}

function getSvelteIgnoreEdit(
    svelteDoc: SvelteDocument,
    ast: Ast,
    diagnostic: Diagnostic
) {
    const { code, range: { start, end } } = diagnostic;
    const content = svelteDoc.getText();
    const { html } = ast;

    const diagnosticStartOffset = svelteDoc.offsetAt(start);
    const diagnosticEndOffset = svelteDoc.offsetAt(end);
    const OffsetRange = {
        start: diagnosticStartOffset,
        end: diagnosticEndOffset
    };

    const node = findTagForRange(html, OffsetRange);

    const nodeStartPosition = positionAt(node.start, content);
    const nodeLineStart = svelteDoc.offsetAt({
        line: nodeStartPosition.line,
        character: 0
    });
    const afterStartLineStart = content.slice(nodeLineStart);
    const indent = /^[ |\t]+/.exec(afterStartLineStart)?.[0] ?? '';

    // TODO: Make all code action's new line consistent
    const ignore = `${indent}<!-- svelte-ignore ${code} -->${EOL}`;
    const position = Position.create(nodeStartPosition.line, 0);

    return TextEdit.insert(position, ignore);
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
