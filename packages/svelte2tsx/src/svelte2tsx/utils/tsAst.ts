import MagicString from 'magic-string';
import ts from 'typescript';

export function isInterfaceOrTypeDeclaration(
    node: ts.Node
): node is ts.TypeAliasDeclaration | ts.InterfaceDeclaration {
    return ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node);
}

export function findExportKeyword(node: ts.Node) {
    return ts.canHaveModifiers(node)
        ? ts.getModifiers(node)?.find((x) => x.kind == ts.SyntaxKind.ExportKeyword)
        : undefined;
}

/**
 * Node is like `bla = ...` or `{bla} = ...` or `[bla] = ...`
 */
function isAssignmentBinaryExpr(node: ts.Expression): node is ts.BinaryExpression {
    return (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind == ts.SyntaxKind.EqualsToken &&
        (ts.isIdentifier(node.left) ||
            ts.isObjectLiteralExpression(node.left) ||
            ts.isArrayLiteralExpression(node.left))
    );
}

/**
 * Returns if node is like `$: bla = ...` or `$: ({bla} = ...)` or `$: [bla] = ...=`
 */
export function getBinaryAssignmentExpr(
    node: ts.LabeledStatement
): ts.BinaryExpression | undefined {
    if (ts.isExpressionStatement(node.statement)) {
        if (isAssignmentBinaryExpr(node.statement.expression)) {
            return node.statement.expression;
        }
        if (
            ts.isParenthesizedExpression(node.statement.expression) &&
            isAssignmentBinaryExpr(node.statement.expression.expression)
        ) {
            return node.statement.expression.expression;
        }
    }
}

/**
 * Returns true if node is like `({bla} ..)` or `([bla] ...)`
 */
export function isParenthesizedObjectOrArrayLiteralExpression(
    node: ts.Expression
): node is ts.ParenthesizedExpression {
    return (
        ts.isParenthesizedExpression(node) &&
        ts.isBinaryExpression(node.expression) &&
        (ts.isObjectLiteralExpression(node.expression.left) ||
            ts.isArrayLiteralExpression(node.expression.left))
    );
}

/**
 *
 * Adapted from https://github.com/Rich-Harris/periscopic/blob/d7a820b04e1f88b452313ab3e54771b352f0defb/src/index.ts#L150
 */
export function extractIdentifiers(
    node: ts.Node,
    identifiers: ts.Identifier[] = []
): ts.Identifier[] {
    if (ts.isIdentifier(node)) {
        identifiers.push(node);
    } else if (ts.isBindingElement(node)) {
        extractIdentifiers(node.name, identifiers);
    } else if (isMember(node)) {
        let object: ts.Node = node;
        while (isMember(object)) {
            object = object.expression;
        }
        if (ts.isIdentifier(object)) {
            identifiers.push(object);
        }
    } else if (ts.isArrayBindingPattern(node) || ts.isObjectBindingPattern(node)) {
        node.elements.forEach((element) => {
            extractIdentifiers(element, identifiers);
        });
    } else if (ts.isObjectLiteralExpression(node)) {
        node.properties.forEach((child) => {
            if (ts.isSpreadAssignment(child)) {
                extractIdentifiers(child.expression, identifiers);
            } else if (ts.isShorthandPropertyAssignment(child)) {
                // in ts Ast { a = 1 } and { a } are both ShorthandPropertyAssignment
                extractIdentifiers(child.name, identifiers);
            } else if (ts.isPropertyAssignment(child)) {
                // { a: b }
                extractIdentifiers(child.initializer, identifiers);
            }
        });
    } else if (ts.isArrayLiteralExpression(node)) {
        node.elements.forEach((element) => {
            if (ts.isSpreadElement(element)) {
                extractIdentifiers(element, identifiers);
            } else {
                extractIdentifiers(element, identifiers);
            }
        });
    } else if (ts.isBinaryExpression(node)) {
        extractIdentifiers(node.left, identifiers);
    }

    return identifiers;
}

export function isMember(
    node: ts.Node
): node is ts.ElementAccessExpression | ts.PropertyAccessExpression {
    return ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node);
}

/**
 * Returns variable at given level with given name,
 * if it is a variable declaration in the form of `const/let a = ..`
 */
export function getVariableAtTopLevel(
    node: ts.SourceFile,
    identifierName: string
): ts.VariableDeclaration | undefined {
    for (const child of node.statements) {
        if (ts.isVariableStatement(child)) {
            const variable = child.declarationList.declarations.find(
                (declaration) =>
                    ts.isIdentifier(declaration.name) && declaration.name.text === identifierName
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
export function getLastLeadingDoc(node: ts.Node): string | undefined {
    const nodeText = node.getFullText();
    const comments = ts
        .getLeadingCommentRanges(nodeText, 0)
        ?.filter((c) => c.kind === ts.SyntaxKind.MultiLineCommentTrivia);
    const comment = comments?.[comments?.length - 1];

    if (comment) {
        let commentText = nodeText.substring(comment.pos, comment.end);

        const typedefTags = ts.getAllJSDocTagsOfKind(node, ts.SyntaxKind.JSDocTypedefTag);
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
export function isNotPropertyNameOfImport(identifier: ts.Identifier): boolean {
    return (
        !ts.isImportSpecifier(identifier.parent) || identifier.parent.propertyName !== identifier
    );
}

/**
 * Extract the variable names that are assigned to out of a labeled statement.
 */
export function getNamesFromLabeledStatement(node: ts.LabeledStatement): string[] {
    const leftHandSide = getBinaryAssignmentExpr(node)?.left;
    if (!leftHandSide) {
        return [];
    }

    return (
        extractIdentifiers(leftHandSide)
            .map((id) => id.text)
            // svelte won't let you create a variable with $ prefix (reserved for stores)
            .filter((name) => !name.startsWith('$'))
    );
}

export function isSafeToPrefixWithSemicolon(node: ts.Identifier): boolean {
    let parent = node.parent;
    while (parent && !ts.isExpressionStatement(parent)) {
        parent = parent.parent;
    }
    if (!parent) {
        return false;
    }
    return (
        parent.getStart() === node.getStart() &&
        !(
            parent.parent &&
            (ts.isIfStatement(parent.parent) ||
                ts.isForStatement(parent.parent) ||
                ts.isForInStatement(parent.parent) ||
                ts.isForOfStatement(parent.parent) ||
                ts.isWhileStatement(parent.parent))
        )
    );
}

/**
 * move node to top of script so they appear outside our render function
 */
export function moveNode(
    node: ts.Node,
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
function isNewGroup(sourceFile: ts.SourceFile, topLevelImportDecl: ts.Node, scanner: ts.Scanner) {
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
