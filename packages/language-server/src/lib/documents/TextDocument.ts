import { urlToPath } from '../../utils';
import { WritableDocument } from './Document';

export class TextDocument extends WritableDocument {

    public languageId = 'svelte';

    constructor(public url: string, public content: string) {
        super();
    }

    getText() {
        return this.content;
    }

    getURL() {
        return this.url;
    }

    setText(text: string) {
        this.content = text;
    }

    getFilePath(): string | null {
        return urlToPath(this.url);
    }
}
