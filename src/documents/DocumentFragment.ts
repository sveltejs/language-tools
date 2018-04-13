import { Position } from 'vscode-languageserver-types';
import { Document } from './Document';

export interface FragmentResolver {
    start: number;
    end: number;
    attributes?: Record<string, string>;
}

export class DocumentFragment extends Document {
    /**
     * @param parent The fragment's parent document
     * @param offsets The start and end offset in the parent document
     */
    constructor(private parent: Document, public fragment: FragmentResolver) {
        super();
    }

    /**
     * Get the fragment offset relative to the parent
     * @param offset Offset in fragment
     */
    offsetInParent(offset: number): number {
        return this.fragment.start + offset;
    }

    /**
     * Get the fragment position relative to the parent
     * @param pos Position in fragment
     */
    positionInParent(pos: Position): Position {
        const parentOffset = this.offsetInParent(this.offsetAt(pos));
        return this.parent.positionAt(parentOffset);
    }

    /**
     * Get the offset relative to the start of the fragment
     * @param offset Offset in parent
     */
    offsetInFragment(offset: number): number {
        return offset - this.fragment.start;
    }

    /**
     * Get the position relative to the start of the fragment
     * @param pos Position in parent
     */
    positionInFragment(pos: Position): Position {
        const fragmentOffset = this.offsetInFragment(this.parent.offsetAt(pos));
        return this.positionAt(fragmentOffset);
    }

    /**
     * Returns true if the given parent position is inside of this fragment
     * @param pos Position in parent
     */
    isInFragment(pos: Position): boolean {
        const offset = this.parent.offsetAt(pos);
        return offset >= this.fragment.start && offset <= this.fragment.end;
    }

    /**
     * Get the fragment text from the parent
     */
    getText(): string {
        return this.parent.getText().slice(this.fragment.start, this.fragment.end);
    }

    /**
     * Update the fragment text in the parent
     */
    setText(text: string): void {
        this.parent.update(text, this.fragment.start, this.fragment.end);
    }

    getTextLength(): number {
        return this.fragment.end - this.fragment.start;
    }
}
