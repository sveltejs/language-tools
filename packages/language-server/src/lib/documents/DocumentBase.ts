import {
    Position,
    Range,
    TextDocument,
    TextDocumentContentChangeEvent
} from 'vscode-languageserver';
import { getLineOffsets, offsetAt, positionAt } from './utils';

/**
 * Represents a textual document.
 */
export abstract class ReadableDocument implements TextDocument {
    /**
     * Get the text content of the document
     */
    abstract getText(range?: Range): string;

    /**
     * Returns the url of the document
     */
    abstract getURL(): string;

    /**
     * Returns the file path if the url scheme is file
     */
    abstract getFilePath(): string | null;

    /**
     * Current version of the document.
     */
    public version = 0;

    /**
     * Should be cleared when there's an update to the text
     */
    protected lineOffsets?: number[];

    /**
     * Get the length of the document's content
     */
    getTextLength(): number {
        return this.getText().length;
    }

    /**
     * Get the line and character based on the offset
     * @param offset The index of the position
     */
    positionAt(offset: number): Position {
        return positionAt(offset, this.getText(), this.getLineOffsets());
    }

    /**
     * Get the index of the line and character position
     * @param position Line and character position
     */
    offsetAt(position: Position): number {
        return offsetAt(position, this.getText(), this.getLineOffsets());
    }

    private getLineOffsets() {
        if (!this.lineOffsets) {
            this.lineOffsets = getLineOffsets(this.getText());
        }
        return this.lineOffsets;
    }

    /**
     * Implements TextDocument
     */
    get uri(): string {
        return this.getURL();
    }

    get lineCount(): number {
        return this.getText().split(/\r?\n/).length;
    }

    abstract languageId: string;
}

/**
 * Represents a textual document that can be manipulated.
 */
export abstract class WritableDocument extends ReadableDocument {
    /**
     * Set the text content of the document.
     * Implementers should set `lineOffsets` to `undefined` here.
     * @param text The new text content
     */
    abstract setText(text: string): void;

    /**
     * Batch update the document with the LSP change events.
     */
    update(changes: TextDocumentContentChangeEvent[]): void {
        const pendingChanges: { text: string; start: number; end: number }[] = [];
        for (const change of changes) {
            let start = 0;
            let end = 0;
            if ('range' in change) {
                start = this.offsetAt(change.range.start);
                end = this.offsetAt(change.range.end);
            } else {
                end = this.getTextLength();
            }

            pendingChanges.push({ text: change.text, start, end });
        }

        // VSCode already sends the change in this order,
        // But it's not written in the spec, so sorting it just to be sure.
        const sortedDescending = pendingChanges.sort((a, b) => b.end - a.end);
        const content = this.getText();
        let newText = content;
        for (const change of sortedDescending) {
            newText = newText.slice(0, change.start) + change.text + newText.slice(change.end);
        }
        this.lineOffsets = undefined;
        this.setText(newText);
    }
}
