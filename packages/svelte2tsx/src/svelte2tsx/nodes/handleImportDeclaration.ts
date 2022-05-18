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
    const scanner = ts.createScanner(sourceFile.languageVersion, /*skipTrivia*/ false, sourceFile.languageVariant);

    if (isNewGroup(sourceFile,node, scanner)) {
        str.appendRight(node.getStart() + astOffset, '\n');
    }

    const comments = ts.getLeadingCommentRanges(node.getFullText(), 0) ?? [];
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

function isNewGroup(sourceFile: ts.SourceFile, topLevelImportDecl: ts.ImportDeclaration, scanner: ts.Scanner) {
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