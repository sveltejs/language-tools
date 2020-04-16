import { Fragment, Position, Document } from '../../api';
import { extractTag } from '../../lib/documents/utils';

export class TypescriptFragment {
    private version!: number;
    private info!: {
        attributes: {};
        start: number;
        end: number;
    };

    constructor(private document: Document) {
        this.update();
    }

    /**
     * Start of fragment within document.
     */
    get start(): number {
        this.update();
        return this.info.start;
    }

    /**
     * End of fragment within document.
     */
    get end(): number {
        this.update();
        return this.info.end;
    }

    /**
     * Attributes of fragment within document.
     */
    get attributes(): Record<string, string> {
        this.update();
        return { ...this.info.attributes, tag: 'script' };
    }

    /**
     * Find the tag in the document if we detected a change
     */
    private update() {
        if (this.document.version === this.version) {
            return;
        }

        this.version = this.document.version;
        const info = extractTag(this.document.getText(), 'script');
        if (info) {
            this.info = info;
            return;
        }

        const length = this.document.getTextLength();
        this.info = {
            attributes: {},
            start: length,
            end: length,
        };
    }
}

export class TypescriptDocument extends Document implements Fragment {
    private typescriptFragment: TypescriptFragment;

    constructor(private parent: Document) {
        super();
        this.typescriptFragment = new TypescriptFragment(parent);
    }

    /**
     * Get the fragment position relative to the parent
     * @param pos Position in fragment
     */
    positionInParent(pos: Position): Position {
        const parentOffset = this.typescriptFragment.start + this.offsetAt(pos);
        return this.parent.positionAt(parentOffset);
    }

    /**
     * Get the position relative to the start of the fragment
     * @param pos Position in parent
     */
    positionInFragment(pos: Position): Position {
        const fragmentOffset = this.parent.offsetAt(pos) - this.typescriptFragment.start;
        return this.positionAt(fragmentOffset);
    }

    /**
     * Returns true if the given parent position is inside of this fragment
     * @param pos Position in parent
     */
    isInFragment(pos: Position): boolean {
        const offset = this.parent.offsetAt(pos);
        return offset >= this.typescriptFragment.start && offset <= this.typescriptFragment.end;
    }

    /**
     * Get the fragment text from the parent
     */
    getText(): string {
        return this.parent
            .getText()
            .slice(this.typescriptFragment.start, this.typescriptFragment.end);
    }

    /**
     * Returns the length of the fragment as calculated from the start and end positon
     */
    getTextLength(): number {
        return this.typescriptFragment.end - this.typescriptFragment.start;
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

    getAttributes() {
        return this.typescriptFragment.attributes;
    }
}
