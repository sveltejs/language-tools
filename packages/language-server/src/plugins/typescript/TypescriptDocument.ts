import { Position } from 'vscode-languageserver';
import { extractTag, Document, Fragment, positionAt, offsetAt } from '../../lib/documents';
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import { isSvelteFilePath } from './utils';
import svelte2tsx from 'svelte2tsx';
import { DocumentMapper, IdentityMapper, ConsumerDocumentMapper } from './DocumentMapper';

export class TypescriptFragment implements Fragment {
    constructor(private mapper: DocumentMapper, private text: string, private url: string) {}

    positionInParent(pos: Position): Position {
        return this.mapper.getOriginalPosition(pos)!;
    }

    positionInFragment(pos: Position): Position {
        return this.mapper.getGeneratedPosition(pos)!;
    }

    isInFragment(pos: Position): boolean {
        return true;
    }

    getURL(): string {
        return this.url;
    }

    positionAt(offset: number) {
        return positionAt(offset, this.text);
    }

    offsetAt(position: Position) {
        return offsetAt(position, this.text);
    }
}

export class TypescriptDocument extends Document {
    private text: string;
    private tsxMap?: RawSourceMap;
    private attributes: Record<string, string>;
    private fragment?: TypescriptFragment;
    private _version: number;

    constructor(private parent: Document) {
        super();
        this._version = parent.version;

        this.attributes = extractTag(parent.getText(), 'script')?.attributes || {};
        this.attributes = { ...this.attributes, tag: 'script' };

        this.text = parent.getText();

        if (isSvelteFilePath(parent.uri)) {
            try {
                const tsx = svelte2tsx(parent.getText());
                this.text = tsx.code;
                this.tsxMap = tsx.map;
                if (this.tsxMap) {
                    this.tsxMap.sources = [parent.uri];
                }
            } catch (e) {
                this.text = '';
                console.error(`Couldn't convert ${parent.uri} to tsx`, e);
            }
        }
    }

    /**
     * Get the fragment text from the parent
     */
    getText(): string {
        return this.text;
    }

    /**
     * Returns the length of the fragment as calculated from the start and end positon
     */
    getTextLength(): number {
        return this.text.length;
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
        return this._version;
    }

    set version(version: number) {
        // ignore
    }

    getAttributes() {
        return this.attributes;
    }

    async getFragment() {
        if (!this.fragment) {
            const mapper = !this.tsxMap
                ? new IdentityMapper()
                : new ConsumerDocumentMapper(
                      await new SourceMapConsumer(this.tsxMap),
                      this.parent.uri,
                  );
            this.fragment = new TypescriptFragment(mapper, this.text, this.getURL());
        }
        return this.fragment;
    }
}
