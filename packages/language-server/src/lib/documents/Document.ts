import { urlToPath } from '../../utils';
import { WritableDocument } from './DocumentBase';
import { extractScriptTags, extractStyleTag, extractTemplateTag, TagInformation } from './utils';
import { parseHtml } from './parseHtml';
import { SvelteConfig, configLoader } from './configLoader';
import { HTMLDocument } from 'vscode-html-languageservice';
import { Range } from 'vscode-languageserver';

/**
 * Represents a text document contains a svelte component.
 */
export class Document extends WritableDocument {
    languageId = 'svelte';
    scriptInfo: TagInformation | null = null;
    moduleScriptInfo: TagInformation | null = null;
    styleInfo: TagInformation | null = null;
    templateInfo: TagInformation | null = null;
    configPromise: Promise<SvelteConfig | undefined>;
    config?: SvelteConfig;
    html!: HTMLDocument;
    openedByClient = false;
    /**
     * Compute and cache directly because of performance reasons
     * and it will be called anyway.
     */
    private path = urlToPath(this.url);

    constructor(
        public url: string,
        public content: string
    ) {
        super();
        this.configPromise = configLoader.awaitConfig(this.getFilePath() || '');
        this.updateDocInfo();
    }

    private updateDocInfo() {
        this.html = parseHtml(this.content);
        const update = (config: SvelteConfig | undefined) => {
            const scriptTags = extractScriptTags(this.content, this.html);
            this.config = config;
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
            this.templateInfo = this.addDefaultLanguage(
                config,
                extractTemplateTag(this.content, this.html),
                'markup'
            );
        };

        const config = configLoader.getConfig(this.getFilePath() || '');
        if (config && !config.loadConfigError) {
            update(config);
        } else {
            update(undefined);
            this.configPromise.then((c) => update(c));
        }
    }

    /**
     * Get text content
     */
    getText(range?: Range): string {
        if (range) {
            return this.content.substring(this.offsetAt(range.start), this.offsetAt(range.end));
        }
        return this.content;
    }

    /**
     * Set text content and increase the document version
     */
    setText(text: string) {
        this.content = text;
        this.version++;
        this.lineOffsets = undefined;
        this.updateDocInfo();
    }

    /**
     * Returns the file path if the url scheme is file
     */
    getFilePath(): string | null {
        return this.path;
    }

    /**
     * Get URL file path.
     */
    getURL() {
        return this.url;
    }

    /**
     * Returns the language associated to script, style or template.
     * Returns an empty string if there's nothing set.
     */
    getLanguageAttribute(tag: 'script' | 'style' | 'template'): string {
        const attrs =
            (tag === 'style'
                ? this.styleInfo?.attributes
                : tag === 'script'
                  ? this.scriptInfo?.attributes || this.moduleScriptInfo?.attributes
                  : this.templateInfo?.attributes) || {};
        const lang = attrs.lang || attrs.type || '';
        return lang.replace(/^text\//, '');
    }

    /**
     * Returns true if there's `lang="X"` on script or style or template.
     */
    hasLanguageAttribute(): boolean {
        return (
            !!this.getLanguageAttribute('script') ||
            !!this.getLanguageAttribute('style') ||
            !!this.getLanguageAttribute('template')
        );
    }

    /**
     * @deprecated This no longer exists in svelte-preprocess v5, we leave it in in case someone is using this with v4
     */
    private addDefaultLanguage(
        config: SvelteConfig | undefined,
        tagInfo: TagInformation | null,
        tag: 'style' | 'script' | 'markup'
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
