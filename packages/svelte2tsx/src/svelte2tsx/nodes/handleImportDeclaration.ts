import MagicString from 'magic-string';
import type ts from 'typescript';
import type { TsFacade } from '../../facade';
import { nextLineOrNonWhitespace } from '../utils/tsAst';

export function moveAllInstanceImports(
    ts: TsFacade,
    tsAst: ts.SourceFile,
    astOffset: number,
    hasModuleScript: boolean,
    scriptStart: number,
    str: MagicString
) {
    let prepend = hasModuleScript ? '\n\n' : '\n';
    const pending: ts.ImportDeclaration[] = [];
    let lastMovedEnd: number | undefined;
    for (const statement of tsAst.statements) {
        if (ts.isImportDeclaration(statement)) {
            pending.push(statement);
            continue;
        }
        if (pending.length) {
            lastMovedEnd = moveImportGroup(ts, pending, str, astOffset, scriptStart, prepend);
            pending.length = 0;
            prepend = '\n';
        }
    }
    if (pending.length) {
        lastMovedEnd = moveImportGroup(ts, pending, str, astOffset, scriptStart, prepend);
        pending.length = 0;
    }

    if (lastMovedEnd != undefined) {
        const charBefore = str.original.charCodeAt(lastMovedEnd - 1);
        if (charBefore !== 10 /*\n*/) {
            str.appendLeft(lastMovedEnd, '\n');
        }
    }
}

function moveImportGroup(
    ts: TsFacade,
    imports: ts.ImportDeclaration[],
    str: MagicString,
    astOffset: number,
    scriptStart: number,
    prependStr: string
) {
    // Starting from the start line of the import or its leading comment
    // Avoid moving the astOffset so that the $store declaration and snippet won't move with it.
    const start = nextLineOrNonWhitespace(ts, str.original, imports[0].pos + astOffset);

    if (prependStr) {
        str.appendRight(start, prependStr);
    }

    // Next auto-import is inserted here. Remove import also ends with here.
    const end = nextLineOrNonWhitespace(
        ts,
        str.original,
        imports[imports.length - 1].end + astOffset
    );
    str.move(start, end, scriptStart + 1);
    return end;
}
