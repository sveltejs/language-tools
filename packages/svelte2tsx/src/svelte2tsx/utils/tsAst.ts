import MagicString from 'magic-string';
import type ts from 'typescript';

export function isInterfaceOrTypeDeclaration(
    tsModule: typeof ts,
    node: ts.Node
): node is ts.TypeAliasDeclaration | ts.InterfaceDeclaration {
    return tsModule.isTypeAliasDeclaration(node) || tsModule.isInterfaceDeclaration(node);
}

export function findExportKeyword(tsModule: typeof ts, node: ts.Node) {
    return tsModule.canHaveModifiers(node)
        ? tsModule.getModifiers(node)?.find((x) => x.kind == tsModule.SyntaxKind.ExportKeyword)
        : undefined;
}

/**
 * Node is like `bla = ...` or `{bla} = ...` or `[bla] = ...`
 */
function isAssignmentBinaryExpr(
    tsModule: typeof ts,
    node: ts.Expression
): node is ts.BinaryExpression {
    return (
        tsModule.isBinaryExpression(node) &&
        node.operatorToken.kind == tsModule.SyntaxKind.EqualsToken &&
        (tsModule.isIdentifier(node.left) ||
            tsModule.isObjectLiteralExpression(node.left) ||
            tsModule.isArrayLiteralExpression(node.left))
    );
}

/**
 * Returns if node is like `$: bla = ...` or `$: ({bla} = ...)` or `$: [bla] = ...=`
 */
export function getBinaryAssignmentExpr(
    tsModule: typeof ts,
    node: ts.LabeledStatement
): ts.BinaryExpression | undefined {
    if (tsModule.isExpressionStatement(node.statement)) {
        if (isAssignmentBinaryExpr(tsModule, node.statement.expression)) {
            return node.statement.expression;
        }
        if (
            tsModule.isParenthesizedExpression(node.statement.expression) &&
            isAssignmentBinaryExpr(tsModule, node.statement.expression.expression)
        ) {
            return node.statement.expression.expression;
        }
    }
}

/**
 * Returns true if node is like `({bla} ..)` or `([bla] ...)`
 */
export function isParenthesizedObjectOrArrayLiteralExpression(
    tsModule: typeof ts,
    node: ts.Expression
): node is ts.ParenthesizedExpression {
    return (
        tsModule.isParenthesizedExpression(node) &&
        tsModule.isBinaryExpression(node.expression) &&
        (tsModule.isObjectLiteralExpression(node.expression.left) ||
            tsModule.isArrayLiteralExpression(node.expression.left))
    );
}

/**
 *
 * Adapted from https://github.com/Rich-Harris/periscopic/blob/d7a820b04e1f88b452313ab3e54771b352f0defb/src/index.ts#L150
 */
export function extractIdentifiers(
    tsModule: typeof ts,
    node: ts.Node,
    identifiers: ts.Identifier[] = []
): ts.Identifier[] {
    if (tsModule.isIdentifier(node)) {
        identifiers.push(node);
    } else if (tsModule.isBindingElement(node)) {
        extractIdentifiers(tsModule, node.name, identifiers);
    } else if (isMember(tsModule, node)) {
        let object: ts.Node = node;
        while (isMember(tsModule, object)) {
            object = object.expression;
        }
        if (tsModule.isIdentifier(object)) {
            identifiers.push(object);
        }
    } else if (tsModule.isArrayBindingPattern(node) || tsModule.isObjectBindingPattern(node)) {
        node.elements.forEach((element) => {
            extractIdentifiers(tsModule, element, identifiers);
        });
    } else if (tsModule.isObjectLiteralExpression(node)) {
        node.properties.forEach((child) => {
            if (tsModule.isSpreadAssignment(child)) {
                extractIdentifiers(tsModule, child.expression, identifiers);
            } else if (tsModule.isShorthandPropertyAssignment(child)) {
                // in ts Ast { a = 1 } and { a } are both ShorthandPropertyAssignment
                extractIdentifiers(tsModule, child.name, identifiers);
            } else if (tsModule.isPropertyAssignment(child)) {
                // { a: b }
                extractIdentifiers(tsModule, child.initializer, identifiers);
            }
        });
    } else if (tsModule.isArrayLiteralExpression(node)) {
        node.elements.forEach((element) => {
            if (tsModule.isSpreadElement(element)) {
                extractIdentifiers(tsModule, element, identifiers);
            } else {
                extractIdentifiers(tsModule, element, identifiers);
            }
        });
    } else if (tsModule.isBinaryExpression(node)) {
        extractIdentifiers(tsModule, node.left, identifiers);
    }

    return identifiers;
}

export function isMember(
    tsModule: typeof ts,
    node: ts.Node
): node is ts.ElementAccessExpression | ts.PropertyAccessExpression {
    return tsModule.isElementAccessExpression(node) || tsModule.isPropertyAccessExpression(node);
}

/**
 * Returns variable at given level with given name,
 * if it is a variable declaration in the form of `const/let a = ..`
 */
export function getVariableAtTopLevel(
    tsModule: typeof ts,
    node: ts.SourceFile,
    identifierName: string
): ts.VariableDeclaration | undefined {
    for (const child of node.statements) {
        if (tsModule.isVariableStatement(child)) {
            const variable = child.declarationList.declarations.find(
                (declaration) =>
                    tsModule.isIdentifier(declaration.name) &&
                    declaration.name.text === identifierName
            );
            if (variable) {
                return variable;
            }
        }
    }
}

/**
 * Get the leading multiline trivia doc of the node.
 */
export function getLastLeadingDoc(tsModule: typeof ts, node: ts.Node): string | undefined {
    const nodeText = node.getFullText();
    const comments = tsModule
        .getLeadingCommentRanges(nodeText, 0)
        ?.filter((c) => c.kind === tsModule.SyntaxKind.MultiLineCommentTrivia);
    const comment = comments?.[comments?.length - 1];

    if (comment) {
        let commentText = nodeText.substring(comment.pos, comment.end);

        const typedefTags = tsModule.getAllJSDocTagsOfKind(
            node,
            tsModule.SyntaxKind.JSDocTypedefTag
        );
        typedefTags
            .filter((tag) => tag.pos >= comment.pos)
            .map((tag) => nodeText.substring(tag.pos, tag.end))
            .forEach((comment) => {
                commentText = commentText.replace(comment, '');
            });

        return commentText;
    }
}

/**
 * Returns true if given identifier is not the property name of an aliased import.
 * In other words: It is not `a` in `import {a as b} from ..`
 */
export function isNotPropertyNameOfImport(tsModule: typeof ts, identifier: ts.Identifier): boolean {
    return (
        !tsModule.isImportSpecifier(identifier.parent) ||
        identifier.parent.propertyName !== identifier
    );
}

/**
 * Extract the variable names that are assigned to out of a labeled statement.
 */
export function getNamesFromLabeledStatement(
    tsModule: typeof ts,
    node: ts.LabeledStatement
): string[] {
    const leftHandSide = getBinaryAssignmentExpr(tsModule, node)?.left;
    if (!leftHandSide) {
        return [];
    }

    return (
        extractIdentifiers(tsModule, leftHandSide)
            .map((id) => id.text)
            // svelte won't let you create a variable with $ prefix (reserved for stores)
            .filter((name) => !name.startsWith('$'))
    );
}

export function isSafeToPrefixWithSemicolon(tsModule: typeof ts, node: ts.Identifier): boolean {
    let parent = node.parent;
    while (parent && !tsModule.isExpressionStatement(parent)) {
        parent = parent.parent;
    }
    if (!parent) {
        return false;
    }
    return (
        parent.getStart() === node.getStart() &&
        !(
            parent.parent &&
            (tsModule.isIfStatement(parent.parent) ||
                tsModule.isForStatement(parent.parent) ||
                tsModule.isForInStatement(parent.parent) ||
                tsModule.isForOfStatement(parent.parent) ||
                tsModule.isWhileStatement(parent.parent))
        )
    );
}

/**
 * move node to top of script so they appear outside our render function
 */

export function moveNode(
    tsModule: typeof ts,
    node: ts.Node,
    str: MagicString,
    astOffset: number,
    scriptStart: number,
    sourceFile: ts.SourceFile
) {
    const scanner = tsModule.createScanner(
        sourceFile.languageVersion,
        /*skipTrivia*/ false,
        sourceFile.languageVariant
    );

    const comments = tsModule.getLeadingCommentRanges(node.getFullText(), 0) ?? [];
    if (
        !comments.some((comment) => comment.hasTrailingNewLine) &&
        isNewGroup(tsModule, sourceFile, node, scanner)
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
    tsModule: typeof ts,
    sourceFile: ts.SourceFile,
    topLevelImportDecl: ts.Node,
    scanner: ts.Scanner
) {
    const startPos = topLevelImportDecl.getFullStart();
    const endPos = topLevelImportDecl.getStart();
    scanner.setText(sourceFile.text, startPos, endPos - startPos);

    let numberOfNewLines = 0;
    while (scanner.getTokenPos() < endPos) {
        const tokenKind = scanner.scan();

        if (tokenKind === tsModule.SyntaxKind.NewLineTrivia) {
            numberOfNewLines++;

            if (numberOfNewLines >= 2) {
                return true;
            }
        }
    }

    return false;
}

export function getTopLevelImports(
    tsModule: typeof ts,
    sourceFile: ts.SourceFile
): ts.ImportDeclaration[] {
    return sourceFile.statements.filter(tsModule.isImportDeclaration).sort((a, b) => a.end - b.end);
}
