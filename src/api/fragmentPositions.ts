import {
    Fragment,
    CompletionItem,
    TextEdit,
    Range,
    Hover,
    Diagnostic,
    ColorInformation,
    ColorPresentation,
    SymbolInformation,
    Location,
    LocationLink,
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

export function mapLocationToParent(fragment: Fragment, loc: Location): Location {
    return { ...loc, range: mapRangeToParent(fragment, loc.range) };
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

export function mapSymbolInformationToParent(
    fragment: Fragment,
    info: SymbolInformation,
): SymbolInformation {
    return { ...info, location: mapLocationToParent(fragment, info.location) };
}

export function mapLocationLinkToParent(fragment: Fragment, def: LocationLink): LocationLink {
    return LocationLink.create(
        def.targetUri,
        def.targetRange,
        def.targetSelectionRange,
        def.originSelectionRange ? mapRangeToParent(fragment, def.originSelectionRange) : undefined,
    );
}
