import ts from 'typescript';
import MagicString from 'magic-string';

export class ImplicitTopLevelNames {
    private map = new Map<string, ts.LabeledStatement>();

    add(identifier: ts.Identifier, node: ts.LabeledStatement, astOffset: number, str: MagicString) {
        const name = identifier.text;

        // svelte won't let you create a variable with $ prefix anyway
        const isPotentialStore = name.startsWith('$');

        if (!this.map.has(name) && !isPotentialStore) {
            this.map.set(name, node);
        }

        // TODO don't do this if the variable inside the expression is defined explicetly
        if (
            ts.isExpressionStatement(node.statement) &&
            ts.isParenthesizedExpression(node.statement.expression)
        ) {
            const start = node.statement.expression.getStart() + astOffset;
            str.remove(start, start + 1);
            const end = node.statement.expression.getEnd() + astOffset - 1;
            str.remove(end, end + 1);
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

    private propertyNamesOfObjectLiteral(node: ts.ObjectLiteralExpression) {
        return node.properties
            .filter(ts.isShorthandPropertyAssignment)
            .map((prop) => prop.name.text);
    }
}
