import ts from 'typescript';

export function findExportKeyword(node: ts.Node) {
    return node.modifiers?.find((x) => x.kind == ts.SyntaxKind.ExportKeyword);
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
    node: ts.LabeledStatement,
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
    node: ts.Expression,
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
    identifiers: ts.Identifier[] = [],
): ts.Identifier[] {
    if (ts.isIdentifier(node)) {
        identifiers.push(node);
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
            extractIdentifiers(element);
        });
    } else if (ts.isObjectLiteralExpression(node)) {
        node.properties.forEach((child) => {
            if (ts.isSpreadAssignment(child)) {
                extractIdentifiers(child.expression, identifiers);
            } else if (ts.isShorthandPropertyAssignment(child)) {
                // in ts Ast { a = 1 } and { a } are both ShorthandPropertyAssignment
                extractIdentifiers(child.name, identifiers);
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
    }

    return identifiers;
}

export function isMember(
    node: ts.Node,
): node is ts.ElementAccessExpression | ts.PropertyAccessExpression {
    return ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node);
}

/**
 * Returns variable at given level with given name,
 * if it is a variable declaration in the form of `const/let a = ..`
 */
export function getVariableAtTopLevel(
    node: ts.SourceFile,
    identifierName: string,
): ts.VariableDeclaration | undefined {
    for (const child of node.statements) {
        if (ts.isVariableStatement(child)) {
            const variable = child.declarationList.declarations.find(
                (declaration) =>
                    ts.isIdentifier(declaration.name) && declaration.name.text === identifierName,
            );
            if (variable) {
                return variable;
            }
        }
    }
}
