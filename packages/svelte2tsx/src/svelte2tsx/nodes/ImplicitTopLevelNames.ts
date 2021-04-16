import ts from 'typescript';
import MagicString from 'magic-string';
import {
	isParenthesizedObjectOrArrayLiteralExpression,
	getNamesFromLabeledStatement
} from '../utils/tsAst';

export class ImplicitTopLevelNames {
	private map = new Set<ts.LabeledStatement>();

	add(node: ts.LabeledStatement) {
		this.map.add(node);
	}

	modifyCode(rootVariables: Set<string>, astOffset: number, str: MagicString) {
		for (const node of this.map.values()) {
			const names = getNamesFromLabeledStatement(node);
			if (names.length === 0) {
				continue;
			}

			const implicitTopLevelNames = names.filter((name) => !rootVariables.has(name));
			const pos = node.label.getStart();

			if (this.hasOnlyImplicitTopLevelNames(names, implicitTopLevelNames)) {
				// remove '$:' label
				str.remove(pos + astOffset, pos + astOffset + 2);
				str.prependRight(pos + astOffset, 'let ');

				this.removeBracesFromParenthizedExpression(node, astOffset, str);
			} else {
				implicitTopLevelNames.forEach((name) => {
					str.prependRight(pos + astOffset, `let ${name};\n`);
				});
			}
		}
	}

	private hasOnlyImplicitTopLevelNames(names: string[], implicitTopLevelNames: string[]) {
		return names.length === implicitTopLevelNames.length;
	}

	private removeBracesFromParenthizedExpression(
		node: ts.LabeledStatement,
		astOffset: number,
		str: MagicString
	) {
		// If expression is of type `$: ({a} = b);`,
		// remove the surrounding braces so that the transformation
		// to `let {a} = b;` produces valid code.
		if (
			ts.isExpressionStatement(node.statement) &&
			isParenthesizedObjectOrArrayLiteralExpression(node.statement.expression)
		) {
			const start = node.statement.expression.getStart() + astOffset;
			str.overwrite(start, start + 1, '', { contentOnly: true });
			const end = node.statement.expression.getEnd() + astOffset - 1;
			str.overwrite(end, end + 1, '', { contentOnly: true });
		}
	}
}
