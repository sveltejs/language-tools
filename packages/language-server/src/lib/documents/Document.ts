import { urlToPath } from '../../utils';
import { WritableDocument } from './DocumentBase';
import { extractScriptTags, extractStyleTag, TagInformation, parseHtml } from './utils';
import { SvelteConfig, loadConfig } from './configLoader';
import { HTMLDocument } from 'vscode-html-languageservice';

/**
 * Represents a text document contains a svelte component.
 */
export class Document extends WritableDocument {
    languageId = 'svelte';
    scriptInfo: TagInformation | null = null;
    moduleScriptInfo: TagInformation | null = null;
    styleInfo: TagInformation | null = null;
    config!: SvelteConfig;
    html!: HTMLDocument;

    constructor(public url: string, public content: string) {
        super();
        this.updateDocInfo();
    }

    private updateDocInfo() {
        if (!this.config || this.config.loadConfigError) {
            this.config = loadConfig(this.getFilePath() || '');
        }
        this.html = parseHtml(this.content);
        const scriptTags = extractScriptTags(this.content, this.html);
        this.scriptInfo = this.addDefaultLanguage(scriptTags?.script || null, 'script');
        this.moduleScriptInfo = this.addDefaultLanguage(scriptTags?.moduleScript || null, 'script');
        this.styleInfo = this.addDefaultLanguage(extractStyleTag(this.content, this.html), 'style');
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
        this.updateDocInfo();
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

    private addDefaultLanguage(
        tagInfo: TagInformation | null,
        tag: 'style' | 'script',
    ): TagInformation | null {
        if (!tagInfo) {
            return null;
        }

        const defaultLang = Array.isArray(this.config.preprocess)
            ? this.config.preprocess.find((group) => group.defaultLanguages?.[tag])
                  ?.defaultLanguages?.[tag]
            : this.config.preprocess?.defaultLanguages?.[tag];

        if (!tagInfo.attributes.lang && !tagInfo.attributes.type && defaultLang) {
            tagInfo.attributes.lang = defaultLang;
        }

        return tagInfo;
    }
}
