import {
    Fragment,
    CompletionItem,
    TextEdit,
    Range,
    Hover,
    Diagnostic,
    ColorInformation,
    ColorPresentation,
} from './interfaces';

export function mapRangeToParent(fragment: Fragment, range: Range): Range {
    return Range.create(
        fragment.positionInParent(range.start),
        fragment.positionInParent(range.end),
    );
}

export function mapRangeToFragment(fragment: Fragment, range: Range): Range {
    return Range.create(
        fragment.positionInFragment(range.start),
        fragment.positionInFragment(range.end),
    );
}

export function mapTextEditToParent(fragment: Fragment, edit: TextEdit): TextEdit {
    return { ...edit, range: mapRangeToParent(fragment, edit.range) };
}

export function mapCompletionItemToParent(
    fragment: Fragment,
    item: CompletionItem,
): CompletionItem {
    if (!item.textEdit) {
        return item;
    }

    return { ...item, textEdit: mapTextEditToParent(fragment, item.textEdit) };
}

export function mapHoverToParent(fragment: Fragment, hover: Hover): Hover {
    if (!hover.range) {
        return hover;
    }

    return { ...hover, range: mapRangeToParent(fragment, hover.range) };
}

export function mapDiagnosticToParent(fragment: Fragment, diagnostic: Diagnostic): Diagnostic {
    return { ...diagnostic, range: mapRangeToParent(fragment, diagnostic.range) };
}

export function mapColorInformationToParent(
    fragment: Fragment,
    info: ColorInformation,
): ColorInformation {
    return { ...info, range: mapRangeToParent(fragment, info.range) };
}

export function mapColorPresentationToParent(
    fragment: Fragment,
    presentation: ColorPresentation,
): ColorPresentation {
    const item = {
        ...presentation,
    };

    if (item.textEdit) {
        item.textEdit = mapTextEditToParent(fragment, item.textEdit);
    }

    if (item.additionalTextEdits) {
        item.additionalTextEdits = item.additionalTextEdits.map(edit =>
            mapTextEditToParent(fragment, edit),
        );
    }

    return item;
}
