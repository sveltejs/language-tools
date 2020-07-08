import { RawSourceMap, SourceMapConsumer } from 'source-map';
import svelte2tsx from 'svelte2tsx';
import ts from 'typescript';
import { Position, Range } from 'vscode-languageserver';
import {
    Document,
    DocumentMapper,
    FragmentMapper,
    IdentityMapper,
    offsetAt,
    positionAt,
    TagInformation,
    isInTag,
} from '../../lib/documents';
import { pathToUrl } from '../../utils';
import { ConsumerDocumentMapper } from './DocumentMapper';
import { getScriptKindFromAttributes, getScriptKindFromFileName, isSvelteFilePath } from './utils';

/**
 * An error which occured while trying to parse/preprocess the svelte file contents.
 */
export interface ParserError {
    message: string;
    range: Range;
    code: number;
}

/**
 * Initial version of snapshots.
 */
export const INITIAL_VERSION = 0;

/**
 * A document snapshot suitable for the ts language service and the plugin.
 * Can be a svelte or ts/js file.
 */
export interface DocumentSnapshot extends ts.IScriptSnapshot {
    version: number;
    filePath: string;
    scriptKind: ts.ScriptKind;
    positionAt(offset: number): Position;
    /**
     * Instantiates a source mapper.
     * `destroyFragment` needs to be called when
     * it's no longer needed / the class should be cleaned up
     * in order to prevent memory leaks.
     */
    getFragment(): Promise<SnapshotFragment>;
    /**
     * Needs to be called when source mapper
     * is no longer needed / the class should be cleaned up
     * in order to prevent memory leaks.
     */
    destroyFragment(): void;
}

/**
 * The mapper to get from original snapshot positions to generated and vice versa.
 */
export interface SnapshotFragment extends DocumentMapper {
    scriptInfo: TagInformation | null;
    positionAt(offset: number): Position;
    offsetAt(position: Position): number;
}

/**
 * Options that apply to svelte files.
 */
export interface SvelteSnapshotOptions {
    strictMode: boolean;
}

export namespace DocumentSnapshot {
    /**
     * Returns a svelte snapshot from a svelte document.
     * @param document the svelte document
     * @param options options that apply to the svelte document
     */
    export function fromDocument(document: Document, options: SvelteSnapshotOptions) {
        const { tsxMap, text, parserError, nrPrependedLines } = preprocessSvelteFile(
            document,
            options,
        );

        return new SvelteDocumentSnapshot(document, parserError, text, nrPrependedLines, tsxMap);
    }

    /**
     * Returns a svelte or ts/js snapshot from a file path, depending on the file contents.
     * @param filePath path to the js/ts/svelte file
     * @param options options that apply in case it's a svelte file
     */
    export function fromFilePath(filePath: string, options: SvelteSnapshotOptions) {
        const originalText = ts.sys.readFile(filePath) ?? '';

        if (isSvelteFilePath(filePath)) {
            return fromDocument(new Document(pathToUrl(filePath), originalText), options);
        } else {
            return new JSOrTSDocumentSnapshot(INITIAL_VERSION, filePath, originalText);
        }
    }
}

/**
 * Tries to preprocess the svelte document and convert the contents into better analyzable js/ts(x) content.
 */
function preprocessSvelteFile(document: Document, options: SvelteSnapshotOptions) {
    let tsxMap: RawSourceMap | undefined;
    let parserError: ParserError | null = null;
    let nrPrependedLines = 0;
    let text = document.getText();

    try {
        const tsx = svelte2tsx(text, {
            strictMode: options.strictMode,
            filename: document.getFilePath() ?? undefined,
        });
        text = tsx.code;
        tsxMap = tsx.map;
        if (tsxMap) {
            tsxMap.sources = [document.uri];

            const tsCheck = document.scriptInfo?.content.match(tsCheckRegex);
            if (tsCheck) {
                // second-last entry is the capturing group with the exact ts-check wording
                text = `//${tsCheck[tsCheck.length - 3]}${ts.sys.newLine}` + text;
                nrPrependedLines = 1;
            }
        }
    } catch (e) {
        // Error start/end logic is different and has different offsets for line, so we need to convert that
        const start: Position = {
            line: e.start?.line - 1 ?? 0,
            character: e.start?.column ?? 0,
        };
        const end: Position = e.end ? { line: e.end.line - 1, character: e.end.column } : start;

        parserError = {
            range: { start, end },
            message: e.message,
            code: -1,
        };

        // fall back to extracted script, if any
        text = document.scriptInfo ? document.scriptInfo.content : '';
    }

    return { tsxMap, text, parserError, nrPrependedLines };
}

/**
 * A svelte document snapshot suitable for the ts language service and the plugin.
 */
export class SvelteDocumentSnapshot implements DocumentSnapshot {
    private fragment?: SvelteSnapshotFragment;
    private _scriptKind?: ts.ScriptKind;

    version = this.parent.version;

    constructor(
        private readonly parent: Document,
        public readonly parserError: ParserError | null,
        private readonly text: string,
        private readonly nrPrependedLines: number,
        private readonly tsxMap?: RawSourceMap,
    ) {}

    get filePath() {
        return this.parent.getFilePath() || '';
    }

    get scriptKind() {
        if (!this._scriptKind) {
            const scriptKind = getScriptKindFromAttributes(
                this.parent.scriptInfo?.attributes ?? {},
            );
            const moduleScriptKind = getScriptKindFromAttributes(
                this.parent.moduleScriptInfo?.attributes ?? {},
            );
            this._scriptKind = [scriptKind, moduleScriptKind].includes(ts.ScriptKind.TSX)
                ? ts.ScriptKind.TSX
                : ts.ScriptKind.JSX;
        }
        return this._scriptKind;
    }

    getText(start: number, end: number) {
        return this.text.substring(start, end);
    }

    getLength() {
        return this.text.length;
    }

    getChangeRange() {
        return undefined;
    }

    positionAt(offset: number) {
        return positionAt(offset, this.text);
    }

    async getFragment() {
        if (!this.fragment) {
            const uri = pathToUrl(this.filePath);
            this.fragment = new SvelteSnapshotFragment(
                await this.getMapper(uri),
                this.text,
                this.parent,
                uri,
            );
        }
        return this.fragment;
    }

    destroyFragment() {
        if (this.fragment) {
            this.fragment.destroy();
            this.fragment = undefined;
        }
    }

    private async getMapper(uri: string) {
        if (!this.parent.scriptInfo) {
            return new IdentityMapper(uri);
        }
        if (!this.tsxMap) {
            return new FragmentMapper(this.parent.getText(), this.parent.scriptInfo, uri);
        }
        return new ConsumerDocumentMapper(
            await new SourceMapConsumer(this.tsxMap),
            uri,
            this.nrPrependedLines,
        );
    }
}

/**
 * A js/ts document snapshot suitable for the ts language service and the plugin.
 * Since no mapping has to be done here, it also implements the mapper interface.
 */
export class JSOrTSDocumentSnapshot extends IdentityMapper
    implements DocumentSnapshot, SnapshotFragment {
    scriptKind = getScriptKindFromFileName(this.filePath);
    scriptInfo = null;

    constructor(
        public version: number,
        public readonly filePath: string,
        private readonly text: string,
    ) {
        super(pathToUrl(filePath));
    }

    getText(start: number, end: number) {
        return this.text.substring(start, end);
    }

    getLength() {
        return this.text.length;
    }

    getChangeRange() {
        return undefined;
    }

    positionAt(offset: number) {
        return positionAt(offset, this.text);
    }

    offsetAt(position: Position): number {
        return offsetAt(position, this.text);
    }

    async getFragment() {
        return this;
    }

    destroyFragment() {
        // nothing to clean up
    }
}

/**
 * The mapper to get from original svelte document positions
 * to generated snapshot positions and vice versa.
 */
export class SvelteSnapshotFragment implements SnapshotFragment {
    constructor(
        private readonly mapper: DocumentMapper,
        public readonly text: string,
        private readonly parent: Document,
        private readonly url: string,
    ) {}

    get scriptInfo() {
        return this.parent.scriptInfo;
    }

    getOriginalPosition(pos: Position): Position {
        return this.mapper.getOriginalPosition(pos);
    }

    getGeneratedPosition(pos: Position): Position {
        return this.mapper.getGeneratedPosition(pos);
    }

    isInGenerated(pos: Position): boolean {
        return !isInTag(pos, this.parent.styleInfo);
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

    /**
     * Needs to be called when source mapper is no longer needed in order to prevent memory leaks.
     */
    destroy() {
        if (this.mapper.destroy) {
            this.mapper.destroy();
        }
    }
}

// The following regex matches @ts-check or @ts-nocheck if:
// - it is before the first line of code (so other lines with comments before it are ok)
// - must be @ts-(no)check
// - the comment which has @ts-(no)check can have any type of whitespace before it, but not other characters
// - what's coming after @ts-(no)check is irrelevant as long there is any kind of whitespace or line break, so this would be picked up, too: // @ts-check asdasd
// [ \t\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
// is just \s (a.k.a any whitespace character) without linebreak and vertical tab
// eslint-disable-next-line
const tsCheckRegex = /^(\s*(\/\/[ \t\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\S]*)*\s*)*(\/\/[ \t\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*(@ts-(no)?check)($|\s))/;
