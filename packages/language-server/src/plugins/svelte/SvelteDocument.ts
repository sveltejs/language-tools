import { Position, WritableDocument, Fragment } from '../../api';
import { extractTag, offsetAt } from '../../lib/documents/utils';
import { urlToPath } from '../../utils';

/**
 * Represents a text document that contains a svelte component.
 */
export class SvelteDocument extends WritableDocument {
    public script: SvelteFragment;
    public style: SvelteFragment;

    constructor(public url: string, public content: string) {
        super();

        this.script = new SvelteFragment(this, new SvelteFragmentDetails(this, 'script'));
        this.style = new SvelteFragment(this, new SvelteFragmentDetails(this, 'style'));
    }

    /**
     * Get text content
     */
    getText(): string {
        return this.content;
    }

    /**
     * Set text content and increase the document version
     */
    setText(text: string) {
        this.content = text;
        this.version++;
    }

    /**
     * Returns the file path if the url scheme is file
     */
    getFilePath(): string | null {
        return urlToPath(this.url);
    }

    getURL() {
        return this.url;
    }

    getAttributes() {
        return {};
    }
}

export class SvelteFragment implements Fragment {
    /**
     * @param parent The fragment's parent document
     * @param offsets The start and end offset in the parent document
     */
    constructor(private parent: WritableDocument, public details: SvelteFragmentDetails) {}

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
        const parentOffset = this.offsetInParent(
            offsetAt(pos, this.parent.getText().slice(this.details.start, this.details.end)),
        );
        return this.parent.positionAt(parentOffset);
    }

    /**
     * Get the position relative to the start of the fragment
     * @param pos Position in parent
     */
    positionInFragment(pos: Position): Position {
        const fragmentOffset = this.parent.offsetAt(pos) - this.details.start;
        return this.parent.positionAt(fragmentOffset);
    }

    /**
     * Returns true if the given parent position is inside of this fragment
     * @param pos Position in parent
     */
    isInFragment(pos: Position): boolean {
        const offset = this.parent.offsetAt(pos);
        return offset >= this.details.start && offset <= this.details.end;
    }

    getURL() {
        return this.parent.getURL();
    }
}

export class SvelteFragmentDetails {
    private info!: {
        start: number;
        end: number;
        container?: {
            start: number;
            end: number;
        };
        attributes: Record<string, string>;
    };
    private version = -1;

    constructor(public document: SvelteDocument, public tag: 'style' | 'script') {
        this.update();
    }

    get start(): number {
        this.update();
        return this.info.start;
    }

    get end(): number {
        this.update();
        return this.info.end;
    }

    get container() {
        this.update();
        return this.info.container;
    }

    get attributes(): Record<string, string> {
        this.update();
        return { ...this.info.attributes, tag: this.tag };
    }

    /**
     * Find the tag in the document if we detected a change
     */
    private update() {
        if (this.document.version === this.version) {
            return;
        }

        this.version = this.document.version;
        const info = extractTag(this.document.getText(), this.tag);
        if (info) {
            this.info = info;
            return;
        }

        const length = this.document.getTextLength();
        this.info = {
            attributes: {},
            start: length,
            end: length,
            container: {
                start: length,
                end: length,
            },
        };
    }
}
