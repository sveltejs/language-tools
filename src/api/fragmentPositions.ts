import { Fragment, CompletionItem, TextEdit, MarkupContent, Command, Range } from './interfaces';

export function mapCompletionItemToParent(
    fragment: Fragment,
    item: CompletionItem,
): CompletionItem {
    if (!item.textEdit) {
        return item;
    }

    return { ...item, textEdit: mapTextEditToParent(fragment, item.textEdit) };
}

export function mapTextEditToParent(fragment: Fragment, edit: TextEdit): TextEdit {
    return { ...edit, range: mapRangeToParent(fragment, edit.range) };
}

export function mapRangeToParent(fragment: Fragment, range: Range): Range {
    return Range.create(
        fragment.positionInParent(range.start),
        fragment.positionInParent(range.end),
    );
}
