import MagicString from 'magic-string';
import type ts from 'typescript';
import { getTopLevelImports, moveNode } from '../utils/tsAst';

/**
 * move imports to top of script so they appear outside our render function
 */
export function handleImportDeclaration(
    tsModule: typeof ts,
    node: ts.ImportDeclaration,
    str: MagicString,
    astOffset: number,
    scriptStart: number,
    sourceFile: ts.SourceFile
) {
    return moveNode(tsModule, node, str, astOffset, scriptStart, sourceFile);
}

/**
 * ensure it's in a newline.
 * if file has module script ensure an empty line to separate imports
 */
export function handleFirstInstanceImport(
    tsModule: typeof ts,
    tsAst: ts.SourceFile,
    astOffset: number,
    hasModuleScript: boolean,
    str: MagicString
) {
    const imports = getTopLevelImports(tsModule, tsAst);
    const firstImport = imports[0];
    if (!firstImport) {
        return;
    }

    const firstComment = Array.from(
        tsModule.getLeadingCommentRanges(firstImport.getFullText(), 0) ?? []
    ).sort((a, b) => a.pos - b.pos)[0];

    const start =
        firstComment && firstComment.kind === tsModule.SyntaxKind.MultiLineCommentTrivia
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
