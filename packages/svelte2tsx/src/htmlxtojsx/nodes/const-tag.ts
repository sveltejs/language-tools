import MagicString from 'magic-string';
import { BaseNode, ConstTag } from '../../interfaces';
import { withTrailingPropertyAccess } from '../utils/node-utils';

export function extractConstTags(children: BaseNode[]) {
    const tags: Array<(insertionPoint: number, str: MagicString) => void> = [];
    for (const child of children) {
        if (child.type === 'ConstTag') {
            const constTag = child as ConstTag;

            tags.push((insertionPoint: number, str: MagicString) => {
                str.appendRight(constTag.expression.left.start, 'const ');

                const expressionEnd = withTrailingPropertyAccess(
                    str.original,
                    constTag.expression.right.end
                );
                str.move(constTag.expression.left.start, expressionEnd, insertionPoint);
                str.appendLeft(expressionEnd, ';');
                str.overwrite(constTag.start + 1, constTag.expression.left.start - 1, '', {
                    contentOnly: true
                });
            });
        }
    }
    return tags;
}
