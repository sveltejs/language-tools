import MagicString from 'magic-string';
import ts from 'typescript';
import { getTopLevelImports, moveNode } from '../utils/tsAst';

/**
 * move imports to top of script so they appear outside our render function
 */
export function handleImportDeclaration(
    node: ts.ImportDeclaration,
    str: MagicString,
    astOffset: number,
    scriptStart: number,
    sourceFile: ts.SourceFile
) {
    return moveNode(node, str, astOffset, scriptStart, sourceFile);
}

/**
 * ensure it's in a newline.
 * if file has module script ensure an empty line to separate imports
 */
export function handleFirstInstanceImport(
    tsAst: ts.SourceFile,
    astOffset: number,
    hasModuleScript: boolean,
    str: MagicString
) {
    const imports = getTopLevelImports(tsAst);
    const firstImport = imports[0];
    if (!firstImport) {
        return;
    }

    const firstComment = Array.from(
        ts.getLeadingCommentRanges(firstImport.getFullText(), 0) ?? []
    ).sort((a, b) => a.pos - b.pos)[0];

    const start =
        firstComment && firstComment.kind === ts.SyntaxKind.MultiLineCommentTrivia
            ? firstComment.pos + firstImport.getFullStart()
            : firstImport.getStart();

    str.appendRight(start + astOffset, '\n' + (hasModuleScript ? '\n' : ''));

    // Add a semi-colon to the last import if it doesn't have one, to prevent auto completion
    // and imports from being added at the wrong position
    const lastImport = imports[imports.length - 1];
    const end = lastImport.end + astOffset - 1;
    if (str.original[end] !== ';') {
        str.overwrite(end, lastImport.end + astOffset, str.original[end] + ';\n');
    }
}

export function moveAllInstanceImports(
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
            lastMovedEnd = moveImportGroup(pending, str, astOffset, scriptStart, prepend);
            pending.length = 0;
            prepend = '\n';
        }
    }
    if (pending.length) {
        lastMovedEnd = moveImportGroup(pending, str, astOffset, scriptStart, prepend);
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
    imports: ts.ImportDeclaration[],
    str: MagicString,
    astOffset: number,
    scriptStart: number,
    prependStr: string
) {
    // Starting from the start line of the import or its leading comment
    // Avoid moving the astOffset so that the $store declaration and snippet won't move with it.
    const start = moveToNewLineOrNonWhitespace(str.original, imports[0].pos + astOffset);

    if (prependStr) {
        str.appendRight(start, prependStr);
    }

    // Next auto-import is inserted here. Remove import also ends with here.
    const end = moveToNewLineOrNonWhitespace(
        str.original,
        imports[imports.length - 1].end + astOffset
    );
    str.move(start, end, scriptStart + 1);
    return end;
}

function moveToNewLineOrNonWhitespace(text: string, pos: number) {
    let nextCharCode = text.charCodeAt(pos);
    while (ts.isWhiteSpaceSingleLine(nextCharCode)) {
        pos++;
        nextCharCode = text.charCodeAt(pos);
    }
    if (nextCharCode === /*\r*/ 13) {
        pos++;
        nextCharCode = text.charCodeAt(pos);
    }
    if (nextCharCode === /*\n*/ 10) {
        pos++;
    }
    return pos;
}
