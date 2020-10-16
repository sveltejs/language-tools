import {
    Position,
    Range,
    CompletionItem,
    Hover,
    Diagnostic,
    ColorPresentation,
    SymbolInformation,
    LocationLink,
    TextDocumentEdit,
    CodeAction,
    SelectionRange
} from 'vscode-languageserver';
import { TagInformation, offsetAt, positionAt } from './utils';
import { SourceMapConsumer } from 'source-map';
import { Logger } from '../../logger';

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

    /**
     * Implement this if you need teardown logic before this mapper gets cleaned up.
     */
    destroy?(): void;
}

/**
 * Does not map, returns positions as is.
 */
export class IdentityMapper implements DocumentMapper {
    constructor(private url: string, private parent?: DocumentMapper) {}

    getOriginalPosition(generatedPosition: Position): Position {
        if (this.parent) {
            generatedPosition = this.getOriginalPosition(generatedPosition);
        }

        return generatedPosition;
    }

    getGeneratedPosition(originalPosition: Position): Position {
        if (this.parent) {
            originalPosition = this.getGeneratedPosition(originalPosition);
        }

        return originalPosition;
    }

    isInGenerated(position: Position): boolean {
        if (this.parent && !this.parent.isInGenerated(position)) {
            return false;
        }

        return true;
    }

    getURL(): string {
        return this.url;
    }

    destroy() {
        this.parent?.destroy?.();
    }
}

/**
 * Maps positions in a fragment relative to a parent.
 */
export class FragmentMapper implements DocumentMapper {
    constructor(
        private originalText: string,
        private tagInfo: TagInformation,
        private url: string
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
        return positionAt(fragmentOffset, this.tagInfo.content);
    }

    isInGenerated(pos: Position): boolean {
        const offset = offsetAt(pos, this.originalText);
        return offset >= this.tagInfo.start && offset <= this.tagInfo.end;
    }

    getURL(): string {
        return this.url;
    }
}

export class SourceMapDocumentMapper implements DocumentMapper {
    constructor(
        protected consumer: SourceMapConsumer,
        protected sourceUri: string,
        private parent?: DocumentMapper
    ) {}

    getOriginalPosition(generatedPosition: Position): Position {
        if (this.parent) {
            generatedPosition = this.parent.getOriginalPosition(generatedPosition);
        }

        const mapped = this.consumer.originalPositionFor({
            line: generatedPosition.line + 1,
            column: generatedPosition.character
        });

        if (!mapped) {
            return { line: -1, character: -1 };
        }

        if (mapped.line === 0) {
            Logger.log('Got 0 mapped line from', generatedPosition, 'col was', mapped.column);
        }

        return {
            line: (mapped.line || 0) - 1,
            character: mapped.column || 0
        };
    }

    getGeneratedPosition(originalPosition: Position): Position {
        if (this.parent) {
            originalPosition = this.parent.getGeneratedPosition(originalPosition);
        }

        const mapped = this.consumer.generatedPositionFor({
            line: originalPosition.line + 1,
            column: originalPosition.character,
            source: this.sourceUri
        });

        if (!mapped) {
            return { line: -1, character: -1 };
        }

        const result = {
            line: (mapped.line || 0) - 1,
            character: mapped.column || 0
        };

        if (result.line < 0) {
            return result;
        }

        return result;
    }

    isInGenerated(position: Position): boolean {
        if (this.parent && !this.isInGenerated(position)) {
            return false;
        }

        const generated = this.getGeneratedPosition(position);
        return generated.line >= 0;
    }

    getURL(): string {
        return this.sourceUri;
    }

    /**
     * Needs to be called when source mapper is no longer needed in order to prevent memory leaks.
     */
    destroy() {
        this.parent?.destroy?.();
        this.consumer.destroy();
    }
}

export function mapRangeToOriginal(
    fragment: Pick<DocumentMapper, 'getOriginalPosition'>,
    range: Range
): Range {
    return Range.create(
        fragment.getOriginalPosition(range.start),
        fragment.getOriginalPosition(range.end)
    );
}

export function mapRangeToGenerated(fragment: DocumentMapper, range: Range): Range {
    return Range.create(
        fragment.getGeneratedPosition(range.start),
        fragment.getGeneratedPosition(range.end)
    );
}

export function mapCompletionItemToOriginal(
    fragment: Pick<DocumentMapper, 'getOriginalPosition'>,
    item: CompletionItem
): CompletionItem {
    if (!item.textEdit) {
        return item;
    }

    return { ...item, textEdit: mapObjWithRangeToOriginal(fragment, item.textEdit) };
}

export function mapHoverToParent(
    fragment: Pick<DocumentMapper, 'getOriginalPosition'>,
    hover: Hover
): Hover {
    if (!hover.range) {
        return hover;
    }

    return { ...hover, range: mapRangeToOriginal(fragment, hover.range) };
}

export function mapObjWithRangeToOriginal<T extends { range: Range }>(
    fragment: Pick<DocumentMapper, 'getOriginalPosition'>,
    objWithRange: T
): T {
    return { ...objWithRange, range: mapRangeToOriginal(fragment, objWithRange.range) };
}

export function mapDiagnosticToGenerated(
    fragment: DocumentMapper,
    diagnostic: Diagnostic
): Diagnostic {
    return { ...diagnostic, range: mapRangeToGenerated(fragment, diagnostic.range) };
}

export function mapColorPresentationToOriginal(
    fragment: Pick<DocumentMapper, 'getOriginalPosition'>,
    presentation: ColorPresentation
): ColorPresentation {
    const item = {
        ...presentation
    };

    if (item.textEdit) {
        item.textEdit = mapObjWithRangeToOriginal(fragment, item.textEdit);
    }

    if (item.additionalTextEdits) {
        item.additionalTextEdits = item.additionalTextEdits.map((edit) =>
            mapObjWithRangeToOriginal(fragment, edit)
        );
    }

    return item;
}

export function mapSymbolInformationToOriginal(
    fragment: Pick<DocumentMapper, 'getOriginalPosition'>,
    info: SymbolInformation
): SymbolInformation {
    return { ...info, location: mapObjWithRangeToOriginal(fragment, info.location) };
}

export function mapLocationLinkToOriginal(
    fragment: DocumentMapper,
    def: LocationLink
): LocationLink {
    return LocationLink.create(
        def.targetUri,
        fragment.getURL() === def.targetUri
            ? mapRangeToOriginal(fragment, def.targetRange)
            : def.targetRange,
        fragment.getURL() === def.targetUri
            ? mapRangeToOriginal(fragment, def.targetSelectionRange)
            : def.targetSelectionRange,
        def.originSelectionRange
            ? mapRangeToOriginal(fragment, def.originSelectionRange)
            : undefined
    );
}

export function mapTextDocumentEditToOriginal(fragment: DocumentMapper, edit: TextDocumentEdit) {
    if (edit.textDocument.uri !== fragment.getURL()) {
        return edit;
    }

    return TextDocumentEdit.create(
        edit.textDocument,
        edit.edits.map((textEdit) => mapObjWithRangeToOriginal(fragment, textEdit))
    );
}

export function mapCodeActionToOriginal(fragment: DocumentMapper, codeAction: CodeAction) {
    return CodeAction.create(
        codeAction.title,
        {
            documentChanges: codeAction.edit!.documentChanges!.map((edit) =>
                mapTextDocumentEditToOriginal(fragment, edit as TextDocumentEdit)
            )
        },
        codeAction.kind
    );
}

export function mapSelectionRangeToParent(
    fragment: Pick<DocumentMapper, 'getOriginalPosition'>,
    selectionRange: SelectionRange
): SelectionRange {
    const { range, parent } = selectionRange;

    return SelectionRange.create(
        mapRangeToOriginal(fragment, range),
        parent && mapSelectionRangeToParent(fragment, parent)
    );
}
