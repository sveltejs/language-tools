import MagicString from 'magic-string';
import ts from 'typescript';

/**
 * Transform type assertion to as expression: <Type>a => a as Type
 */
export function handleTypeAssertion(
    str: MagicString,
    assertion: ts.TypeAssertion,
    astOffset: number
) {
    const { expression, type } = assertion;
    const assertionStart = assertion.getStart() + astOffset;
    const typeStart = type.getStart() + astOffset;
    const typeEnd = type.getEnd() + astOffset;
    const expressionStart = expression.getStart() + astOffset;
    const expressionEnd = expression.getEnd() + astOffset;

    str.appendLeft(expressionEnd, ' as ');
    // move 'HTMLElement' to the end of expression
    str.move(assertionStart, typeEnd, expressionEnd);
    str.remove(assertionStart, typeStart);

    // remove '>'
    str.remove(typeEnd, expressionStart);
}
