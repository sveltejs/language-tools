import ts from 'typescript';
import MagicString from 'magic-string';

export class ImplicitTopLevelNames {
    private map = new Map<string, ts.LabeledStatement>();

    add(
        binaryExpr: ts.BinaryExpression,
        node: ts.LabeledStatement,
        rootVariables: Set<string>,
        astOffset: number,
        str: MagicString,
    ) {
        if (ts.isIdentifier(binaryExpr.left)) {
            this.addSingle(binaryExpr.left, node);
        } else if (ts.isObjectLiteralExpression(binaryExpr.left)) {
            this.getPropsOfObjectLiteral(binaryExpr.left).map((prop) =>
                this.addSingle(prop.name, node),
            );

            if (
                ts.isExpressionStatement(node.statement) &&
                ts.isParenthesizedExpression(node.statement.expression) &&
                this.objectLiteralContainsNoTopLevelNames(binaryExpr.left, rootVariables)
            ) {
                // Expression is of type `$: ({a} = b);`
                // Remove the surrounding braces so that later the the transformation
                // to `let {a} = b;` produces valid code.
                // Do this now, not later, because we use `remove` which would
                // remove everything that we appended/prepended previously.
                const start = node.statement.expression.getStart() + astOffset;
                str.remove(start, start + 1);
                const end = node.statement.expression.getEnd() + astOffset - 1;
                str.remove(end, end + 1);
            }
        }
    }

    private addSingle(identifier: ts.Identifier, node: ts.LabeledStatement) {
        const name = identifier.text;

        // svelte won't let you create a variable with $ prefix anyway
        const isPotentialStore = name.startsWith('$');

        if (!this.map.has(name) && !isPotentialStore) {
            this.map.set(name, node);
        }
    }

    modifyCode(rootVariables: Set<string>, astOffset: number, str: MagicString) {
        for (const [name, node] of this.map.entries()) {
            if (!rootVariables.has(name)) {
                const pos = node.label.getStart();
                // remove '$:' label
                str.remove(pos + astOffset, pos + astOffset + 2);
                str.prependRight(pos + astOffset, `let `);
            }
        }
    }

    private objectLiteralContainsNoTopLevelNames(
        node: ts.ObjectLiteralExpression,
        rootVariables: Set<string>,
    ) {
        return this.getPropsOfObjectLiteral(node).every(
            (prop) => !rootVariables.has(prop.name.text),
        );
    }

    private getPropsOfObjectLiteral(node: ts.ObjectLiteralExpression) {
        return (
            node.properties
                // TODO could also be a property assignment,
                // fix if it ever occurs in the wild.
                .filter(ts.isShorthandPropertyAssignment)
        );
    }
}
