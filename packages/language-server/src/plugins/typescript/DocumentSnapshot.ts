import { RawSourceMap, SourceMapConsumer } from 'source-map';
import svelte2tsx, { IExportedNames } from 'svelte2tsx';
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
import {
    getScriptKindFromAttributes,
    getScriptKindFromFileName,
    isSvelteFilePath,
    getTsCheckComment,
} from './utils';

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
        const {
            tsxMap,
            text,
            exportedNames,
            parserError,
            nrPrependedLines,
            scriptKind,
        } = preprocessSvelteFile(document, options);

        return new SvelteDocumentSnapshot(
            document,
            parserError,
            scriptKind,
            text,
            nrPrependedLines,
            exportedNames,
            tsxMap,
        );
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
    let exportedNames: IExportedNames = { has: () => false };

    const scriptKind = [
        getScriptKindFromAttributes(document.scriptInfo?.attributes ?? {}),
        getScriptKindFromAttributes(document.moduleScriptInfo?.attributes ?? {}),
    ].includes(ts.ScriptKind.TSX)
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.JSX;

    try {
        const tsx = svelte2tsx(text, {
            strictMode: options.strictMode,
            filename: document.getFilePath() ?? undefined,
            isTsFile: scriptKind === ts.ScriptKind.TSX,
        });
        text = tsx.code;
        tsxMap = tsx.map;
        exportedNames = tsx.exportedNames;
        if (tsxMap) {
            tsxMap.sources = [document.uri];

            const tsCheck = getTsCheckComment(document.scriptInfo?.content);
            if (tsCheck) {
                text = tsCheck + text;
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

    return { tsxMap, text, exportedNames, parserError, nrPrependedLines, scriptKind };
}

/**
 * A svelte document snapshot suitable for the ts language service and the plugin.
 */
export class SvelteDocumentSnapshot implements DocumentSnapshot {
    private fragment?: SvelteSnapshotFragment;

    version = this.parent.version;

    constructor(
        private readonly parent: Document,
        public readonly parserError: ParserError | null,
        public readonly scriptKind: ts.ScriptKind,
        private readonly text: string,
        private readonly nrPrependedLines: number,
        private readonly exportedNames: IExportedNames,
        private readonly tsxMap?: RawSourceMap,
    ) {}

    get filePath() {
        return this.parent.getFilePath() || '';
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

    hasProp(name: string): boolean {
        return this.exportedNames.has(name);
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
