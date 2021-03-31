import { urlToPath } from '../../utils';
import { WritableDocument } from './DocumentBase';
import { extractScriptTags, extractStyleTag, TagInformation } from './utils';
import { parseHtml } from './parseHtml';
import { SvelteConfig, getConfig, awaitConfig } from './configLoader';
import { HTMLDocument } from 'vscode-html-languageservice';

/**
 * Represents a text document contains a svelte component.
 */
export class Document extends WritableDocument {
    languageId = 'svelte';
    scriptInfo: TagInformation | null = null;
    moduleScriptInfo: TagInformation | null = null;
    styleInfo: TagInformation | null = null;
    config: Promise<SvelteConfig | undefined>;
    html!: HTMLDocument;

    constructor(public url: string, public content: string) {
        super();
        this.config = awaitConfig(this.getFilePath() || '');
        this.updateDocInfo();
    }

    private updateDocInfo() {
        this.html = parseHtml(this.content);
        const scriptTags = extractScriptTags(this.content, this.html);
        const update = (config: SvelteConfig | undefined) => {
            this.scriptInfo = this.addDefaultLanguage(config, scriptTags?.script || null, 'script');
            this.moduleScriptInfo = this.addDefaultLanguage(
                config,
                scriptTags?.moduleScript || null,
                'script'
            );
            this.styleInfo = this.addDefaultLanguage(
                config,
                extractStyleTag(this.content, this.html),
                'style'
            );
        };

        const config = getConfig(this.getFilePath() || '');
        if (config && !config.loadConfigError) {
            update(config);
        } else {
            this.config = awaitConfig(this.getFilePath() || '');
            update(undefined);
            this.config.then((c) => update(c));
        }
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

    /**
     * Returns the language associated to either script or style.
     * Returns an empty string if there's nothing set.
     */
    getLanguageAttribute(tag: 'script' | 'style'): string {
        const attrs =
            (tag === 'style'
                ? this.styleInfo?.attributes
                : this.scriptInfo?.attributes || this.moduleScriptInfo?.attributes) || {};
        const lang = attrs.lang || attrs.type || '';
        return lang.replace(/^text\//, '');
    }

    private addDefaultLanguage(
        config: SvelteConfig | undefined,
        tagInfo: TagInformation | null,
        tag: 'style' | 'script'
    ): TagInformation | null {
        if (!tagInfo || !config) {
            return tagInfo;
        }

        const defaultLang = Array.isArray(config.preprocess)
            ? config.preprocess.find((group) => group.defaultLanguages?.[tag])?.defaultLanguages?.[
                  tag
              ]
            : config.preprocess?.defaultLanguages?.[tag];

        if (!tagInfo.attributes.lang && !tagInfo.attributes.type && defaultLang) {
            tagInfo.attributes.lang = defaultLang;
        }

        return tagInfo;
    }
}
