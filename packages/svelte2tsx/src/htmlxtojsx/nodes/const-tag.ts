import MagicString from 'magic-string';
import { BaseNode, ConstTag } from '../../interfaces';

export function extractConstTags(children: BaseNode[]) {
    const tags: Array<(insertionPoint: number, str: MagicString) => void> = [];
    for (const child of children) {
        if (child.type === 'ConstTag') {
            const constTag = child as ConstTag;

            tags.push((insertionPoint: number, str: MagicString) => {
                str.appendRight(constTag.expression.left.start, 'const ');
                str.move(
                    constTag.expression.left.start,
                    constTag.expression.right.end,
                    insertionPoint
                );
                str.appendLeft(constTag.expression.right.end, ';');
                str.overwrite(constTag.start + 1, constTag.expression.left.start - 1, '', {
                    contentOnly: true
                });
            });
        }
    }
    return tags;
}
