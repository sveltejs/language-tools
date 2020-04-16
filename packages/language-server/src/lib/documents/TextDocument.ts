import { urlToPath } from '../../utils';
import { WritableDocument } from '../../api';

export class TextDocument extends WritableDocument {
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
