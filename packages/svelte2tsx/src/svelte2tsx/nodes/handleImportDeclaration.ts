import MagicString from 'magic-string';
import ts from 'typescript';

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
    const scanner = ts.createScanner(
        sourceFile.languageVersion,
        /*skipTrivia*/ false,
        sourceFile.languageVariant
    );

    const comments = ts.getLeadingCommentRanges(node.getFullText(), 0) ?? [];
    if (
        !comments.some((comment) => comment.hasTrailingNewLine) &&
        isNewGroup(sourceFile, node, scanner)
    ) {
        str.appendRight(node.getStart() + astOffset, '\n');
    }

    for (const comment of comments) {
        const commentEnd = node.pos + comment.end + astOffset;
        str.move(node.pos + comment.pos + astOffset, commentEnd, scriptStart + 1);

        if (comment.hasTrailingNewLine) {
            str.overwrite(commentEnd - 1, commentEnd, str.original[commentEnd - 1] + '\n');
        }
    }

    str.move(node.getStart() + astOffset, node.end + astOffset, scriptStart + 1);
    //add in a \n
    const originalEndChar = str.original[node.end + astOffset - 1];

    str.overwrite(node.end + astOffset - 1, node.end + astOffset, originalEndChar + '\n');
}

/**
 * adopted from https://github.com/microsoft/TypeScript/blob/6e0447fdf165b1cec9fc80802abcc15bd23a268f/src/services/organizeImports.ts#L111
 */
function isNewGroup(
    sourceFile: ts.SourceFile,
    topLevelImportDecl: ts.ImportDeclaration,
    scanner: ts.Scanner
) {
    const startPos = topLevelImportDecl.getFullStart();
    const endPos = topLevelImportDecl.getStart();
    scanner.setText(sourceFile.text, startPos, endPos - startPos);

    let numberOfNewLines = 0;
    while (scanner.getTokenPos() < endPos) {
        const tokenKind = scanner.scan();

        if (tokenKind === ts.SyntaxKind.NewLineTrivia) {
            numberOfNewLines++;

            if (numberOfNewLines >= 2) {
                return true;
            }
        }
    }

    return false;
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
    const firstImport = tsAst.statements
        .filter(ts.isImportDeclaration)
        .sort((a, b) => a.end - b.end)[0];
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
}
