import { urlToPath } from '../../utils';
import { WritableDocument } from '../../api';

/**
 * Represents a text document that contains a svelte component.
 */
export class ManagedDocument extends WritableDocument {
    constructor(public url: string, public content: string) {
        super();
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

    /**
     * Get URL file path.
     */
    getURL() {
        return this.url;
    }
}
