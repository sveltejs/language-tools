import { Position, Document, FragmentDetails } from '../../api';

export class DocumentFragment extends Document {
    /**
     * @param parent The fragment's parent document
     * @param offsets The start and end offset in the parent document
     */
    constructor(private parent: Document, public details: FragmentDetails) {
        super();
    }

    /**
     * Get the fragment offset relative to the parent
     * @param offset Offset in fragment
     */
    offsetInParent(offset: number): number {
        return this.details.start + offset;
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
        return offset - this.details.start;
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
        return offset >= this.details.start && offset <= this.details.end;
    }

    /**
     * Get the fragment text from the parent
     */
    getText(): string {
        return this.parent.getText().slice(this.details.start, this.details.end);
    }

    /**
     * Update the fragment text in the parent
     */
    setText(text: string): void {
        this.parent.update(text, this.details.start, this.details.end);
    }

    /**
     * Returns the length of the fragment as calculated from the start and end positon
     */
    getTextLength(): number {
        return this.details.end - this.details.start;
    }

    /**
     * Return the parent file path
     */
    getFilePath(): string | null {
        return this.parent.getFilePath();
    }

    getURL() {
        return this.parent.getURL();
    }

    get version(): number {
        return this.parent.version;
    }

    set version(version: number) {
        // ignore
    }
}
