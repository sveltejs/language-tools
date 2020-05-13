import { urlToPath } from '../../utils';
import { WritableDocument } from './DocumentBase';
import { extractTag, TagInformation } from './utils';

/**
 * Represents a text document contains a svelte component.
 */
export class Document extends WritableDocument {
    languageId = 'svelte';
    scriptInfo: TagInformation | null = null;
    styleInfo: TagInformation | null = null;

    constructor(public url: string, public content: string) {
        super();
        this.updateTagInfo();
    }

    private updateTagInfo() {
        this.scriptInfo = extractTag(this.content, 'script');
        this.styleInfo = extractTag(this.content, 'style');
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
        this.updateTagInfo();
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
