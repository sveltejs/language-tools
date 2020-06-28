import { urlToPath } from '../../utils';
import { WritableDocument } from './DocumentBase';
import { TagInformation, extractStyleTag, extractScriptTags } from './utils';

/**
 * Represents a text document contains a svelte component.
 */
export class Document extends WritableDocument {
    languageId = 'svelte';
    scriptInfo: TagInformation | null = null;
    moduleScriptInfo: TagInformation | null = null;
    styleInfo: TagInformation | null = null;

    constructor(public url: string, public content: string) {
        super();
        this.updateTagInfo();
    }

    private updateTagInfo() {
        const scriptTags = extractScriptTags(this.content);
        this.scriptInfo = scriptTags?.script || null;
        this.moduleScriptInfo = scriptTags?.moduleScript || null;
        this.styleInfo = extractStyleTag(this.content);
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
