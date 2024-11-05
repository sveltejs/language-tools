import ts from 'typescript';
import MagicString from 'magic-string';
import {
    isParenthesizedObjectOrArrayLiteralExpression,
    getNamesFromLabeledStatement
} from '../utils/tsAst';
import { overwriteStr, preprendStr } from '../../utils/magic-string';

export class ImplicitTopLevelNames {
    private map = new Set<ts.LabeledStatement>();

    constructor(
        private str: MagicString,
        private astOffset: number
    ) {}

    add(node: ts.LabeledStatement) {
        this.map.add(node);
    }

    handleReactiveStatement(
        node: ts.LabeledStatement,
        binaryExpression: ts.BinaryExpression | undefined
    ): void {
        if (binaryExpression) {
            this.wrapExpressionWithInvalidate(binaryExpression.right);
        } else {
            const start = node.getStart() + this.astOffset;
            const end = node.getEnd() + this.astOffset;

            this.str.prependLeft(start, ';() => {');
            preprendStr(this.str, end, '}');
        }
    }

    private wrapExpressionWithInvalidate(expression: ts.Expression | undefined): void {
        if (!expression) {
            return;
        }

        const start = expression.getStart() + this.astOffset;
        const end = expression.getEnd() + this.astOffset;

        // $: a = { .. }..  /  $: a = .. as ..  =>   () => ( .. )
        if (
            ts.isObjectLiteralExpression(expression) ||
            (expression.getText().startsWith('{') &&
                this.isNodeStartsWithObjectLiteral(expression)) ||
            ts.isAsExpression(expression)
        ) {
            this.str.appendLeft(start, '(');
            this.str.appendRight(end, ')');
        }

        this.str.prependLeft(start, '__sveltets_2_invalidate(() => ');
        preprendStr(this.str, end, ')');
        // Not adding ';' at the end because right now this function is only invoked
        // in situations where there is a line break of ; guaranteed to be present (else the code is invalid)
    }

    private isNodeStartsWithObjectLiteral(node: ts.Node) {
        if (ts.isObjectLiteralExpression(node)) {
            return true;
        }

        if (ts.isElementAccessExpression(node)) {
            return this.isNodeStartsWithObjectLiteral(node.expression);
        }

        if (ts.isBinaryExpression(node)) {
            return this.isNodeStartsWithObjectLiteral(node.left);
        }

        if (ts.isConditionalExpression(node)) {
            return this.isNodeStartsWithObjectLiteral(node.condition);
        }

        return node
            .getChildren()
            .filter((e) => e.pos === node.pos)
            .some((child) => this.isNodeStartsWithObjectLiteral(child));
    }

    modifyCode(rootVariables: Set<string>) {
        for (const node of this.map.values()) {
            const names = getNamesFromLabeledStatement(node);
            if (names.length === 0) {
                continue;
            }

            const implicitTopLevelNames = names.filter((name) => !rootVariables.has(name));
            const pos = node.label.getStart();

            if (this.hasOnlyImplicitTopLevelNames(names, implicitTopLevelNames)) {
                // remove '$:' label
                this.str.remove(pos + this.astOffset, pos + this.astOffset + 2);
                this.str.prependRight(pos + this.astOffset, 'let ');

                this.removeBracesFromParenthizedExpression(node);
            } else {
                implicitTopLevelNames.forEach((name) => {
                    this.str.prependRight(pos + this.astOffset, `let ${name};\n`);
                });
            }
        }
    }

    private hasOnlyImplicitTopLevelNames(names: string[], implicitTopLevelNames: string[]) {
        return names.length === implicitTopLevelNames.length;
    }

    private removeBracesFromParenthizedExpression(node: ts.LabeledStatement) {
        // If expression is of type `$: ({a} = b);`,
        // remove the surrounding braces so that the transformation
        // to `let {a} = b;` produces valid code.
        if (
            ts.isExpressionStatement(node.statement) &&
            isParenthesizedObjectOrArrayLiteralExpression(node.statement.expression)
        ) {
            const parenthesizedExpression = node.statement.expression;

            const parenthesisStart = parenthesizedExpression.getStart() + this.astOffset;
            const expressionStart = parenthesizedExpression.expression.getStart() + this.astOffset;
            this.str.overwrite(parenthesisStart, expressionStart, '', { contentOnly: true });

            const parenthesisEnd = parenthesizedExpression.getEnd() + this.astOffset;
            const expressionEnd = parenthesizedExpression.expression.getEnd() + this.astOffset;
            // We need to keep the `)` of the "wrap with invalidate" expression above.
            // We overwrite the same range so it's needed.
            overwriteStr(this.str, expressionEnd, parenthesisEnd, ')', true);
        }
    }
}
