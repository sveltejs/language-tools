import ts from 'typescript';
import MagicString from 'magic-string';
import { getBinaryAssignmentExpr } from '../utils/tsAst';

export class ImplicitTopLevelNames {
    private map = new Set<ts.LabeledStatement>();

    add(
        binaryExpr: ts.BinaryExpression,
        node: ts.LabeledStatement,
        rootVariables: Set<string>,
        astOffset: number,
        str: MagicString,
    ) {
        this.map.add(node);

        if (
            ts.isExpressionStatement(node.statement) &&
            ts.isParenthesizedExpression(node.statement.expression) &&
            ts.isObjectLiteralExpression(binaryExpr.left) &&
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

    modifyCode(rootVariables: Set<string>, astOffset: number, str: MagicString) {
        for (const node of this.map.values()) {
            const names = this.getNames(node);
            if (names.length === 0) {
                continue;
            }

            const implicitTopLevelNames = this.getNames(node).filter(
                (name) => !rootVariables.has(name),
            );
            const pos = node.label.getStart();
            if (names.length === implicitTopLevelNames.length) {
                // remove '$:' label
                str.remove(pos + astOffset, pos + astOffset + 2);
                str.prependRight(pos + astOffset, `let `);
            } else {
                implicitTopLevelNames.forEach((name) => {
                    str.prependRight(pos + astOffset, `let ${name};\n`);
                });
            }
        }
    }

    private getNames(node: ts.LabeledStatement) {
        const leftHandSide = getBinaryAssignmentExpr(node)?.left;
        if (!leftHandSide) {
            return [];
        }

        // svelte won't let you create a variable with $ prefix (reserved for stores)
        if (ts.isIdentifier(leftHandSide) && !leftHandSide.text.startsWith('$')) {
            return [leftHandSide.text];
        }

        if (ts.isObjectLiteralExpression(leftHandSide)) {
            return this.getPropsOfObjectLiteral(leftHandSide).map((prop) => prop.name.text);
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
