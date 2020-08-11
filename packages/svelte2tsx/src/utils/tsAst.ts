import ts from 'typescript';

export function findExortKeyword(node: ts.Node) {
    return node.modifiers?.find((x) => x.kind == ts.SyntaxKind.ExportKeyword);
}

/**
 * Node is like `bla = ...` or `{bla} = ...`
 */
function isAssignmentBinaryExpr(node: ts.Expression): node is ts.BinaryExpression {
    return (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind == ts.SyntaxKind.EqualsToken &&
        (ts.isIdentifier(node.left) || ts.isObjectLiteralExpression(node.left))
    );
}

/**
 * Returns if node is like `$: bla = ...` or `$: ({bla} = ...)`
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
