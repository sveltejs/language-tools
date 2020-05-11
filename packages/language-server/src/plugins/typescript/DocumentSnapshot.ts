import ts from 'typescript';
import { getScriptKindFromAttributes, isSvelteFilePath, getScriptKindFromFileName } from './utils';
import {
    Fragment,
    positionAt,
    offsetAt,
    Document,
    extractTag,
    TagInformation,
} from '../../lib/documents';
import {
    DocumentMapper,
    IdentityMapper,
    ConsumerDocumentMapper,
    FragmentMapper,
} from './DocumentMapper';
import { Position, Range } from 'vscode-languageserver';
import { SourceMapConsumer, RawSourceMap } from 'source-map';
import { pathToUrl, isInRange } from '../../utils';
import svelte2tsx from 'svelte2tsx';

export interface ParserError {
    message: string;
    range: Range;
    code: number;
}

export const INITIAL_VERSION = 0;

export class DocumentSnapshot implements ts.IScriptSnapshot {
    private fragment?: SnapshotFragment;

    static fromDocument(document: Document) {
        const {
            tsxMap,
            text,
            scriptInfo,
            styleInfo,
            parserError,
            nrPrependedLines,
        } = DocumentSnapshot.preprocessIfIsSvelteFile(document.uri, document.getText());

        return new DocumentSnapshot(
            document.version,
            getScriptKindFromAttributes(extractTag(document.getText(), 'script')?.attributes ?? {}),
            document.getFilePath() || '',
            parserError,
            scriptInfo,
            styleInfo,
            text,
            document.getText(),
            nrPrependedLines,
            tsxMap,
        );
    }

    static fromFilePath(filePath: string) {
        const originalText = ts.sys.readFile(filePath) ?? '';
        const {
            text,
            tsxMap,
            scriptInfo,
            styleInfo,
            parserError,
            nrPrependedLines,
        } = DocumentSnapshot.preprocessIfIsSvelteFile(pathToUrl(filePath), originalText);

        return new DocumentSnapshot(
            INITIAL_VERSION + 1, // ensure it's greater than initial build
            getScriptKindFromFileName(filePath),
            filePath,
            parserError,
            scriptInfo,
            styleInfo,
            text,
            originalText,
            nrPrependedLines,
            tsxMap,
        );
    }

    private static preprocessIfIsSvelteFile(uri: string, text: string) {
        let tsxMap: RawSourceMap | undefined;
        let parserError: ParserError | null = null;
        const scriptInfo = extractTag(text, 'script');
        const styleInfo = extractTag(text, 'style');
        let nrPrependedLines = 0;

        if (isSvelteFilePath(uri)) {
            try {
                const tsx = svelte2tsx(text);
                text = tsx.code;
                tsxMap = tsx.map;
                if (tsxMap) {
                    tsxMap.sources = [uri];

                    const tsCheck = scriptInfo?.content.match(tsCheckRegex);
                    if (tsCheck) {
                        text = `//${tsCheck[2]}${ts.sys.newLine}` + text;
                        nrPrependedLines = 1;
                    }
                }
            } catch (e) {
                // Error start/end logic is different and has different offsets for line, so we need to convert that
                const start: Position = {
                    line: e.start?.line - 1 ?? 0,
                    character: e.start?.column ?? 0,
                };
                const end: Position = e.end
                    ? { line: e.end.line - 1, character: e.end.column }
                    : start;
                parserError = {
                    range: { start, end },
                    message: e.message,
                    code: -1,
                };
                // fall back to extracted script, if any
                text = scriptInfo ? scriptInfo.content : '';
            }
        }

        return { tsxMap, text, scriptInfo, styleInfo, parserError, nrPrependedLines };
    }

    private constructor(
        public version: number,
        public readonly scriptKind: ts.ScriptKind,
        public readonly filePath: string,
        public readonly parserError: ParserError | null,
        public readonly scriptInfo: TagInformation | null,
        public readonly styleInfo: TagInformation | null,
        private readonly text: string,
        private readonly originalText: string,
        private readonly nrPrependedLines: number,
        private readonly tsxMap?: RawSourceMap,
    ) {}

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
            const mapper = !this.scriptInfo
                ? new IdentityMapper()
                : !this.tsxMap
                ? new FragmentMapper(this.originalText, this.scriptInfo)
                : new ConsumerDocumentMapper(
                      await new SourceMapConsumer(this.tsxMap),
                      uri,
                      this.nrPrependedLines,
                  );
            this.fragment = new SnapshotFragment(
                mapper,
                this.text,
                this.scriptInfo,
                this.styleInfo,
                uri,
            );
        }
        return this.fragment;
    }
}

export class SnapshotFragment implements Fragment {
    constructor(
        private readonly mapper: DocumentMapper,
        public readonly text: string,
        public readonly scriptInfo: TagInformation | null,
        public readonly styleInfo: TagInformation | null,
        private readonly url: string,
    ) {}

    positionInParent(pos: Position): Position {
        return this.mapper.getOriginalPosition(pos);
    }

    positionInFragment(pos: Position): Position {
        return this.mapper.getGeneratedPosition(pos);
    }

    isInFragment(pos: Position): boolean {
        return (
            !this.styleInfo ||
            !isInRange(Range.create(this.styleInfo.startPos, this.styleInfo.endPos), pos)
        );
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

// eslint-disable-next-line
const tsCheckRegex = /^\s*(\/\/[ \t\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*(@ts-(no)?check)($|\n|\r\n))/;
