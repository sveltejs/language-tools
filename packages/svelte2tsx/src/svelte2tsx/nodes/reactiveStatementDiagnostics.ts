import MagicString from 'magic-string';
import type ts from 'typescript';
import type { TsFacade } from '../../facade';
import type { SpanMapGenerator } from '../../utils/spanMap';
import { extractIdentifiers } from '../utils/tsAst';

/**
 * Content mapper mode only (TypeScript 7 reports the diagnostics of the output as they are; the TS6
 * language server filters them afterwards in `DiagnosticsProvider`, so its output stays as it is):
 *
 * - "Unused label." (7028) on the `$` of a top-level `$:` statement: an `Ignore` directive over the
 *   label. Nothing else starts a diagnostic there.
 * - "Left side of comma operator is unused and has no side effects." (2695) in `$: a, b, update()`:
 *   listing `let`s as dependencies is intended. Like TS6, the error is kept for the other operands,
 *   on the operand itself. Each operand but the last is rewritten so that TypeScript decides this:
 *   a `let` becomes `__sveltets_2_any(a)` (a call has side effects), any other operand without
 *   side effects becomes `(b, __sveltets_2_any(0))` (TypeScript reports the error on `b`, and the
 *   comma expressions around it don't get one of their own). That's done for the expression of the
 *   `$:` statement, and for the expression statements directly in a `$: { ... }` block.
 */
export function handleReactiveStatementDiagnostics(
    ts: TsFacade,
    str: MagicString,
    astOffset: number,
    tsAst: ts.SourceFile,
    reactiveStatements: ts.LabeledStatement[],
    spanMapGenerator: SpanMapGenerator | undefined
): void {
    if (!spanMapGenerator || !reactiveStatements.length) {
        return;
    }
    const lets = getTopLevelLets(ts, tsAst, reactiveStatements);

    for (const statement of reactiveStatements) {
        const label = statement.label;
        spanMapGenerator.ignoreDiagnosticsOf(
            str,
            astOffset + label.getStart(),
            astOffset + label.getEnd()
        );

        const expressions: ts.Expression[] = [];
        if (ts.isExpressionStatement(statement.statement)) {
            expressions.push(statement.statement.expression);
        } else if (ts.isBlock(statement.statement)) {
            for (const inner of statement.statement.statements) {
                if (ts.isExpressionStatement(inner)) {
                    expressions.push(inner.expression);
                }
            }
        }
        // Known limit: `lets` are the top-level ones by name, block-local bindings in `$: { ... }`
        // aren't taken into account
        for (const expression of expressions) {
            for (const operand of getCommaOperands(ts, expression).slice(0, -1)) {
                const start = astOffset + operand.getStart();
                const end = astOffset + operand.getEnd();
                if (ts.isIdentifier(operand) && (lets.has(operand.text) || isStore(operand))) {
                    str.prependRight(start, '__sveltets_2_any(');
                    str.appendLeft(end, ')');
                } else if (!hasSideEffects(ts, operand)) {
                    str.prependRight(start, '(');
                    str.appendLeft(end, ', __sveltets_2_any(0))');
                }
            }
        }
    }
}

/** `a, b, c` → `[a, b, c]` (commas are left-associative). Not a comma expression → `[expression]` */
function getCommaOperands(ts: TsFacade, expression: ts.Expression): ts.Expression[] {
    const operands: ts.Expression[] = [];
    let current: ts.Expression = expression;
    while (isComma(ts, current)) {
        operands.unshift(current.right);
        current = current.left;
    }
    operands.unshift(current);
    return operands;
}

function isComma(ts: TsFacade, node: ts.Node): node is ts.BinaryExpression {
    return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken;
}

const ASSIGNMENT_OPERATORS = [
    'EqualsToken',
    'PlusEqualsToken',
    'MinusEqualsToken',
    'AsteriskAsteriskEqualsToken',
    'AsteriskEqualsToken',
    'SlashEqualsToken',
    'PercentEqualsToken',
    'AmpersandEqualsToken',
    'BarEqualsToken',
    'CaretEqualsToken',
    'LessThanLessThanEqualsToken',
    'GreaterThanGreaterThanGreaterThanEqualsToken',
    'GreaterThanGreaterThanEqualsToken',
    'BarBarEqualsToken',
    'AmpersandAmpersandEqualsToken',
    'QuestionQuestionEqualsToken'
] as const;

/**
 * Calls, `new`, tagged templates, assignments, `++`/`--`, `await`, `delete` (`yield` can't appear
 * here). Only by kind: the facade has no guards for most of these, and the kinds are read by name.
 */
function hasSideEffects(ts: TsFacade, node: ts.Node): boolean {
    const SK = ts.SyntaxKind;
    const effectKinds = new Set<number>([
        SK.CallExpression,
        SK.NewExpression,
        SK.TaggedTemplateExpression,
        SK.AwaitExpression,
        SK.DeleteExpression
    ]);
    const assignments = new Set<number>(ASSIGNMENT_OPERATORS.map((name) => SK[name]));
    const increments = new Set<number>([SK.PlusPlusToken, SK.MinusMinusToken]);
    let found = false;
    const visit = (child: ts.Node) => {
        if (found) {
            return;
        }
        if (
            effectKinds.has(child.kind) ||
            (ts.isBinaryExpression(child) && assignments.has(child.operatorToken.kind)) ||
            ((child.kind === SK.PrefixUnaryExpression ||
                child.kind === SK.PostfixUnaryExpression) &&
                increments.has((child as ts.PrefixUnaryExpression).operator))
        ) {
            found = true;
            return;
        }
        if (ts.isFunctionLike(child) || child.kind === SK.ClassExpression) {
            // not evaluated here
            return;
        }
        ts.forEachChild(child, visit);
    };
    visit(node);
    return found;
}

/** `$store`: a store value, declared with `let` by svelte2tsx */
function isStore(identifier: ts.Identifier): boolean {
    return identifier.text.startsWith('$') && identifier.text !== '$';
}

/**
 * Top-level `let`s (TS6: `getDefinitionAtPosition(...).kind === 'let'`): declared with `let` or
 * `export let`, and the names `$: name = ...` declares implicitly
 */
function getTopLevelLets(
    ts: TsFacade,
    tsAst: ts.SourceFile,
    reactiveStatements: ts.LabeledStatement[]
): Set<string> {
    const lets = new Set<string>();
    for (const statement of tsAst.statements) {
        if (
            ts.isVariableStatement(statement) &&
            statement.declarationList.flags & ts.NodeFlags.Let
        ) {
            for (const declaration of statement.declarationList.declarations) {
                for (const identifier of extractIdentifiers(ts, declaration.name)) {
                    lets.add(identifier.text);
                }
            }
        }
    }
    for (const statement of reactiveStatements) {
        if (
            ts.isExpressionStatement(statement.statement) &&
            ts.isBinaryExpression(statement.statement.expression) &&
            statement.statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ) {
            for (const identifier of extractIdentifiers(ts, statement.statement.expression.left)) {
                lets.add(identifier.text);
            }
        }
    }
    return lets;
}
