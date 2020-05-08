import ts from 'typescript';
import { getScriptKindFromAttributes, isSvelteFilePath, getScriptKindFromFileName } from './utils';
import { Fragment, positionAt, offsetAt, Document, extractTag } from '../../lib/documents';
import { DocumentMapper, IdentityMapper, ConsumerDocumentMapper } from './DocumentMapper';
import { Position, Range } from 'vscode-languageserver';
import { SourceMapConsumer, RawSourceMap } from 'source-map';
import { pathToUrl } from '../../utils';
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
        const { tsxMap, text, parserError } = DocumentSnapshot.preprocessIfIsSvelteFile(
            document.uri,
            document.getText(),
        );

        return new DocumentSnapshot(
            document.version,
            getScriptKindFromAttributes(extractTag(document.getText(), 'script')?.attributes ?? {}),
            document.getFilePath() || '',
            parserError,
            text,
            tsxMap,
        );
    }

    static fromFilePath(filePath: string) {
        const { text, tsxMap, parserError } = DocumentSnapshot.preprocessIfIsSvelteFile(
            pathToUrl(filePath),
            ts.sys.readFile(filePath) ?? '',
        );

        return new DocumentSnapshot(
            INITIAL_VERSION + 1, // ensure it's greater than initial build
            getScriptKindFromFileName(filePath),
            filePath,
            parserError,
            text,
            tsxMap,
        );
    }

    private static preprocessIfIsSvelteFile(uri: string, text: string) {
        let tsxMap: RawSourceMap | undefined;
        let parserError: ParserError | null = null;

        if (isSvelteFilePath(uri)) {
            try {
                const tsx = svelte2tsx(text);
                text = tsx.code;
                tsxMap = tsx.map;
                if (tsxMap) {
                    tsxMap.sources = [uri];
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
                text = '';
            }
        }

        return { tsxMap, text, parserError };
    }

    private constructor(
        public version: number,
        public scriptKind: ts.ScriptKind,
        public filePath: string,
        public parserError: ParserError | null,
        private text: string,
        private tsxMap?: RawSourceMap,
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
            const mapper = !this.tsxMap
                ? new IdentityMapper()
                : new ConsumerDocumentMapper(await new SourceMapConsumer(this.tsxMap), uri);
            this.fragment = new SnapshotFragment(mapper, this.text, uri);
        }
        return this.fragment;
    }
}

export class SnapshotFragment implements Fragment {
    constructor(private mapper: DocumentMapper, private text: string, private url: string) {}

    positionInParent(pos: Position): Position {
        return this.mapper.getOriginalPosition(pos);
    }

    positionInFragment(pos: Position): Position {
        return this.mapper.getGeneratedPosition(pos);
    }

    isInFragment(): boolean {
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
