import {
    Position,
    Range,
    TextEdit,
    Location,
    CompletionItem,
    Hover,
    Diagnostic,
    ColorInformation,
    ColorPresentation,
    SymbolInformation,
    LocationLink,
    TextDocumentEdit,
    CodeAction,
} from 'vscode-languageserver';
import { TagInformation, offsetAt, positionAt } from './utils';

export interface DocumentMapper {
    /**
     * Map the generated position to the original position
     * @param generatedPosition Position in fragment
     */
    getOriginalPosition(generatedPosition: Position): Position;

    /**
     * Map the original position to the generated position
     * @param originalPosition Position in parent
     */
    getGeneratedPosition(originalPosition: Position): Position;

    /**
     * Returns true if the given original position is inside of the generated map
     * @param pos Position in original
     */
    isInGenerated(pos: Position): boolean;

    /**
     * Get document URL
     */
    getURL(): string;
}

/**
 * Does not map, returns positions as is.
 */
export class IdentityMapper implements DocumentMapper {
    constructor(private url: string) {}

    getOriginalPosition(generatedPosition: Position): Position {
        return generatedPosition;
    }

    getGeneratedPosition(originalPosition: Position): Position {
        return originalPosition;
    }

    isInGenerated(): boolean {
        return true;
    }

    getURL(): string {
        return this.url;
    }
}

/**
 * Maps positions in a fragment relative to a parent.
 */
export class FragmentMapper implements DocumentMapper {
    constructor(
        private originalText: string,
        private tagInfo: TagInformation,
        private url: string,
    ) {}

    getOriginalPosition(generatedPosition: Position): Position {
        const parentOffset = this.offsetInParent(offsetAt(generatedPosition, this.tagInfo.content));
        return positionAt(parentOffset, this.originalText);
    }

    private offsetInParent(offset: number): number {
        return this.tagInfo.start + offset;
    }

    getGeneratedPosition(originalPosition: Position): Position {
        const fragmentOffset = offsetAt(originalPosition, this.originalText) - this.tagInfo.start;
        return positionAt(fragmentOffset, this.originalText);
    }

    isInGenerated(pos: Position): boolean {
        const offset = offsetAt(pos, this.originalText);
        return offset >= this.tagInfo.start && offset <= this.tagInfo.end;
    }

    getURL(): string {
        return this.url;
    }
}

export function mapRangeToParent(fragment: DocumentMapper, range: Range): Range {
    return Range.create(
        fragment.getOriginalPosition(range.start),
        fragment.getOriginalPosition(range.end),
    );
}

export function mapRangeToFragment(fragment: DocumentMapper, range: Range): Range {
    return Range.create(
        fragment.getGeneratedPosition(range.start),
        fragment.getGeneratedPosition(range.end),
    );
}

export function mapTextEditToParent(fragment: DocumentMapper, edit: TextEdit): TextEdit {
    return { ...edit, range: mapRangeToParent(fragment, edit.range) };
}

export function mapLocationToParent(fragment: DocumentMapper, loc: Location): Location {
    return { ...loc, range: mapRangeToParent(fragment, loc.range) };
}

export function mapCompletionItemToParent(
    fragment: DocumentMapper,
    item: CompletionItem,
): CompletionItem {
    if (!item.textEdit) {
        return item;
    }

    return { ...item, textEdit: mapTextEditToParent(fragment, item.textEdit) };
}

export function mapHoverToParent(fragment: DocumentMapper, hover: Hover): Hover {
    if (!hover.range) {
        return hover;
    }

    return { ...hover, range: mapRangeToParent(fragment, hover.range) };
}

export function mapDiagnosticToParent(
    fragment: DocumentMapper,
    diagnostic: Diagnostic,
): Diagnostic {
    return { ...diagnostic, range: mapRangeToParent(fragment, diagnostic.range) };
}

export function mapDiagnosticToFragment(
    fragment: DocumentMapper,
    diagnostic: Diagnostic,
): Diagnostic {
    return { ...diagnostic, range: mapRangeToFragment(fragment, diagnostic.range) };
}

export function mapColorInformationToParent(
    fragment: DocumentMapper,
    info: ColorInformation,
): ColorInformation {
    return { ...info, range: mapRangeToParent(fragment, info.range) };
}

export function mapColorPresentationToParent(
    fragment: DocumentMapper,
    presentation: ColorPresentation,
): ColorPresentation {
    const item = {
        ...presentation,
    };

    if (item.textEdit) {
        item.textEdit = mapTextEditToParent(fragment, item.textEdit);
    }

    if (item.additionalTextEdits) {
        item.additionalTextEdits = item.additionalTextEdits.map((edit) =>
            mapTextEditToParent(fragment, edit),
        );
    }

    return item;
}

export function mapSymbolInformationToParent(
    fragment: DocumentMapper,
    info: SymbolInformation,
): SymbolInformation {
    return { ...info, location: mapLocationToParent(fragment, info.location) };
}

export function mapLocationLinkToParent(fragment: DocumentMapper, def: LocationLink): LocationLink {
    return LocationLink.create(
        def.targetUri,
        fragment.getURL() === def.targetUri
            ? mapRangeToParent(fragment, def.targetRange)
            : def.targetRange,
        fragment.getURL() === def.targetUri
            ? mapRangeToParent(fragment, def.targetSelectionRange)
            : def.targetSelectionRange,
        def.originSelectionRange ? mapRangeToParent(fragment, def.originSelectionRange) : undefined,
    );
}

export function mapTextDocumentEditToParent(fragment: DocumentMapper, edit: TextDocumentEdit) {
    if (edit.textDocument.uri !== fragment.getURL()) {
        return edit;
    }

    return TextDocumentEdit.create(
        edit.textDocument,
        edit.edits.map((textEdit) => mapTextEditToParent(fragment, textEdit)),
    );
}

export function mapCodeActionToParent(fragment: DocumentMapper, codeAction: CodeAction) {
    return CodeAction.create(
        codeAction.title,
        {
            documentChanges: codeAction.edit!.documentChanges!.map((edit) =>
                mapTextDocumentEditToParent(fragment, edit as TextDocumentEdit),
            ),
        },
        codeAction.kind,
    );
}
