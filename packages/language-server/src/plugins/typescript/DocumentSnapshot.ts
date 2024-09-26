import { EncodedSourceMap, TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
// @ts-ignore
import { TemplateNode } from 'svelte/types/compiler/interfaces';
import { svelte2tsx, IExportedNames, internalHelpers } from 'svelte2tsx';
import ts from 'typescript';
import { Position, Range, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import {
    Document,
    DocumentMapper,
    FragmentMapper,
    IdentityMapper,
    offsetAt,
    positionAt,
    TagInformation,
    isInTag,
    getLineOffsets,
    FilePosition
} from '../../lib/documents';
import { pathToUrl, urlToPath } from '../../utils';
import { ConsumerDocumentMapper } from './DocumentMapper';
import { SvelteNode, SvelteNodeWalker, walkSvelteAst } from './svelte-ast-utils';
import {
    getScriptKindFromAttributes,
    getScriptKindFromFileName,
    isSvelteFilePath,
    getTsCheckComment
} from './utils';
import { Logger } from '../../logger';
import { dirname, resolve } from 'path';
import { URI } from 'vscode-uri';
import { surroundWithIgnoreComments } from './features/utils';
import { configLoader } from '../../lib/documents/configLoader';

/**
 * An error which occurred while trying to parse/preprocess the svelte file contents.
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
 * Can be a real ts/js file or a virtual ts/js file which is generated from a Svelte file.
 */
export interface DocumentSnapshot extends ts.IScriptSnapshot, DocumentMapper {
    version: number;
    filePath: string;
    scriptKind: ts.ScriptKind;
    scriptInfo: TagInformation | null;
    positionAt(offset: number): Position;
    offsetAt(position: Position): number;
    /**
     * Convenience function for getText(0, getLength())
     */
    getFullText(): string;
    isOpenedInClient(): boolean;
}

/**
 * Options that apply to svelte files.
 */
export interface SvelteSnapshotOptions {
    parse: typeof import('svelte/compiler').parse | undefined;
    version: string | undefined;
    transformOnTemplateError: boolean;
    typingsNamespace: string;
}

export namespace DocumentSnapshot {
    /**
     * Returns a svelte snapshot from a svelte document.
     * @param document the svelte document
     * @param options options that apply to the svelte document
     */
    export function fromDocument(document: Document, options: SvelteSnapshotOptions) {
        const { tsxMap, htmlAst, text, exportedNames, parserError, nrPrependedLines, scriptKind } =
            preprocessSvelteFile(document, options);

        return new SvelteDocumentSnapshot(
            document,
            parserError,
            scriptKind,
            options.version,
            text,
            nrPrependedLines,
            exportedNames,
            tsxMap,
            htmlAst
        );
    }

    /**
     * Returns a svelte or ts/js snapshot from a file path, depending on the file contents.
     * @param filePath path to the js/ts/svelte file
     * @param createDocument function that is used to create a document in case it's a Svelte file
     * @param options options that apply in case it's a svelte file
     */
    export function fromFilePath(
        filePath: string,
        createDocument: (filePath: string, text: string) => Document,
        options: SvelteSnapshotOptions,
        tsSystem: ts.System
    ) {
        if (isSvelteFilePath(filePath)) {
            return DocumentSnapshot.fromSvelteFilePath(filePath, createDocument, options, tsSystem);
        } else {
            return DocumentSnapshot.fromNonSvelteFilePath(filePath, tsSystem);
        }
    }

    /**
     * Returns a ts/js snapshot from a file path.
     * @param filePath path to the js/ts file
     * @param options options that apply in case it's a svelte file
     */
    export function fromNonSvelteFilePath(filePath: string, tsSystem: ts.System) {
        let originalText = '';

        // The following (very hacky) code makes sure that the ambient module definitions
        // that tell TS "every import ending with .svelte is a valid module" are removed.
        // They exist in svelte2tsx and svelte to make sure that people don't
        // get errors in their TS files when importing Svelte files and not using our TS plugin.
        // If someone wants to get back the behavior they can add an ambient module definition
        // on their own.
        const normalizedPath = filePath.replace(/\\/g, '/');
        if (!normalizedPath.endsWith('node_modules/svelte/types/runtime/ambient.d.ts')) {
            originalText = tsSystem.readFile(filePath) || '';
        }

        if (normalizedPath.endsWith('node_modules/svelte/types/index.d.ts')) {
            const startIdx = originalText.indexOf(`declare module '*.svelte' {`);
            const endIdx = originalText.indexOf(`\n}`, startIdx + 1) + 2;
            originalText =
                originalText.substring(0, startIdx) +
                ' '.repeat(endIdx - startIdx) +
                originalText.substring(endIdx);
        } else if (
            normalizedPath.endsWith('svelte2tsx/svelte-shims.d.ts') ||
            normalizedPath.endsWith('svelte-check/dist/src/svelte-shims.d.ts')
        ) {
            // If not present, the LS uses an older version of svelte2tsx
            if (originalText.includes('// -- start svelte-ls-remove --')) {
                originalText =
                    originalText.substring(
                        0,
                        originalText.indexOf('// -- start svelte-ls-remove --')
                    ) +
                    originalText.substring(originalText.indexOf('// -- end svelte-ls-remove --'));
            }
        }

        const declarationExtensions = [ts.Extension.Dcts, ts.Extension.Dts, ts.Extension.Dmts];
        if (declarationExtensions.some((ext) => normalizedPath.endsWith(ext))) {
            return new DtsDocumentSnapshot(INITIAL_VERSION, filePath, originalText, tsSystem);
        }

        return new JSOrTSDocumentSnapshot(INITIAL_VERSION, filePath, originalText);
    }

    /**
     * Returns a svelte snapshot from a file path.
     * @param filePath path to the svelte file
     * @param createDocument function that is used to create a document
     * @param options options that apply in case it's a svelte file
     */
    export function fromSvelteFilePath(
        filePath: string,
        createDocument: (filePath: string, text: string) => Document,
        options: SvelteSnapshotOptions,
        tsSystem: ts.System
    ) {
        const originalText = tsSystem.readFile(filePath) ?? '';
        return fromDocument(createDocument(filePath, originalText), options);
    }
}

/**
 * Tries to preprocess the svelte document and convert the contents into better analyzable js/ts(x) content.
 */
function preprocessSvelteFile(document: Document, options: SvelteSnapshotOptions) {
    let tsxMap: EncodedSourceMap | undefined;
    let parserError: ParserError | null = null;
    let nrPrependedLines = 0;
    let text = document.getText();
    let exportedNames: IExportedNames = { has: () => false };
    let htmlAst: TemplateNode | undefined;

    const scriptKind = [
        getScriptKindFromAttributes(document.scriptInfo?.attributes ?? {}),
        getScriptKindFromAttributes(document.moduleScriptInfo?.attributes ?? {})
    ].includes(ts.ScriptKind.TSX)
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;

    try {
        const tsx = svelte2tsx(text, {
            parse: options.parse,
            version: options.version,
            filename: document.getFilePath() ?? undefined,
            isTsFile: scriptKind === ts.ScriptKind.TS,
            mode: 'ts',
            typingsNamespace: options.typingsNamespace,
            emitOnTemplateError: options.transformOnTemplateError,
            namespace: document.config?.compilerOptions?.namespace,
            accessors:
                document.config?.compilerOptions?.accessors ??
                document.config?.compilerOptions?.customElement
        });
        text = tsx.code;
        tsxMap = tsx.map as EncodedSourceMap;
        exportedNames = tsx.exportedNames;
        // We know it's there, it's not part of the public API so people don't start using it
        htmlAst = (tsx as any).htmlAst;

        if (tsxMap) {
            tsxMap.sources = [document.uri];

            const scriptInfo = document.scriptInfo || document.moduleScriptInfo;
            const tsCheck = getTsCheckComment(scriptInfo?.content);
            if (tsCheck) {
                text = tsCheck + text;
                nrPrependedLines = 1;
            }
        }
    } catch (e: any) {
        // Error start/end logic is different and has different offsets for line, so we need to convert that
        const start: Position = {
            line: (e.start?.line ?? 1) - 1,
            character: e.start?.column ?? 0
        };
        const end: Position = e.end ? { line: e.end.line - 1, character: e.end.column } : start;

        parserError = {
            range: { start, end },
            message: e.message,
            code: -1
        };

        // fall back to extracted script, if any
        const scriptInfo = document.scriptInfo || document.moduleScriptInfo;
        text = scriptInfo ? scriptInfo.content : '';
    }

    return {
        tsxMap,
        text,
        exportedNames,
        htmlAst,
        parserError,
        nrPrependedLines,
        scriptKind
    };
}

/**
 * A svelte document snapshot suitable for the TS language service and the plugin.
 * It contains the generated code (Svelte->TS/JS) so the TS language service can understand it.
 */
export class SvelteDocumentSnapshot implements DocumentSnapshot {
    private mapper?: DocumentMapper;
    private lineOffsets?: number[];
    private url = pathToUrl(this.filePath);

    version = this.parent.version;
    isSvelte5Plus = Number(this.svelteVersion?.split('.')[0]) >= 5;

    constructor(
        public readonly parent: Document,
        public readonly parserError: ParserError | null,
        public readonly scriptKind: ts.ScriptKind,
        public readonly svelteVersion: string | undefined,
        private readonly text: string,
        private readonly nrPrependedLines: number,
        private readonly exportedNames: IExportedNames,
        private readonly tsxMap?: EncodedSourceMap,
        private readonly htmlAst?: TemplateNode
    ) {}

    get filePath() {
        return this.parent.getFilePath() || '';
    }

    get scriptInfo() {
        return this.parent.scriptInfo;
    }

    get moduleScriptInfo() {
        return this.parent.moduleScriptInfo;
    }

    getOriginalText(range?: Range) {
        return this.parent.getText(range);
    }

    getText(start: number, end: number) {
        return this.text.substring(start, end);
    }

    getLength() {
        return this.text.length;
    }

    getFullText() {
        return this.text;
    }

    getChangeRange() {
        return undefined;
    }

    positionAt(offset: number) {
        return positionAt(offset, this.text, this.getLineOffsets());
    }

    offsetAt(position: Position): number {
        return offsetAt(position, this.text, this.getLineOffsets());
    }

    getLineContainingOffset(offset: number) {
        const chunks = this.getText(0, offset).split('\n');
        return chunks[chunks.length - 1];
    }

    hasProp(name: string): boolean {
        return this.exportedNames.has(name);
    }

    svelteNodeAt(positionOrOffset: number | Position): SvelteNode | null {
        if (!this.htmlAst) {
            return null;
        }
        const offset =
            typeof positionOrOffset === 'number'
                ? positionOrOffset
                : this.parent.offsetAt(positionOrOffset);

        let foundNode: SvelteNode | null = null;
        this.walkSvelteAst({
            enter(node) {
                // In case the offset is at a point where a node ends and a new one begins,
                // the node where the code ends is used. If this introduces problems, introduce
                // an affinity parameter to prefer the node where it ends/starts.
                if (node.start > offset || node.end < offset) {
                    this.skip();
                    return;
                }
                const parent = foundNode;
                // Spread so the "parent" property isn't added to the original ast,
                // causing an infinite loop
                foundNode = { ...node };
                if (parent) {
                    foundNode.parent = parent;
                }
            }
        });

        return foundNode;
    }

    walkSvelteAst(walker: SvelteNodeWalker) {
        if (!this.htmlAst) {
            return;
        }

        walkSvelteAst(this.htmlAst, walker);
    }

    getOriginalPosition(pos: Position): Position {
        return this.getMapper().getOriginalPosition(pos);
    }

    getGeneratedPosition(pos: Position): Position {
        return this.getMapper().getGeneratedPosition(pos);
    }

    isInGenerated(pos: Position): boolean {
        return !isInTag(pos, this.parent.styleInfo);
    }

    getURL(): string {
        return this.url;
    }

    isOpenedInClient() {
        return this.parent.openedByClient;
    }

    private getLineOffsets() {
        if (!this.lineOffsets) {
            this.lineOffsets = getLineOffsets(this.text);
        }
        return this.lineOffsets;
    }

    private getMapper() {
        if (!this.mapper) {
            this.mapper = this.initMapper();
        }
        return this.mapper;
    }

    private initMapper() {
        const scriptInfo = this.parent.scriptInfo || this.parent.moduleScriptInfo;

        if (!this.tsxMap) {
            if (!scriptInfo) {
                return new IdentityMapper(this.url);
            }

            return new FragmentMapper(this.parent.getText(), scriptInfo, this.url);
        }

        return new ConsumerDocumentMapper(
            new TraceMap(this.tsxMap),
            this.url,
            this.nrPrependedLines
        );
    }
}

/**
 * A js/ts document snapshot suitable for the ts language service and the plugin.
 * Since no mapping has to be done here, it also implements the mapper interface.
 * If it's a SvelteKit file (e.g. +page.ts), types will be auto-added if not explicitly typed.
 */
export class JSOrTSDocumentSnapshot extends IdentityMapper implements DocumentSnapshot {
    scriptKind = getScriptKindFromFileName(this.filePath);
    scriptInfo = null;
    originalText = this.text;
    kitFile = false;
    private lineOffsets?: number[];
    private internalLineOffsets?: number[];
    private addedCode: Array<{
        generatedPos: number;
        originalPos: number;
        length: number;
        inserted: string;
        total: number;
    }> = [];
    private paramsPath = 'src/params';
    private serverHooksPath = 'src/hooks.server';
    private clientHooksPath = 'src/hooks.client';
    private universalHooksPath = 'src/hooks';

    private openedByClient = false;

    isOpenedInClient(): boolean {
        return this.openedByClient;
    }

    constructor(
        public version: number,
        public readonly filePath: string,
        private text: string
    ) {
        super(pathToUrl(filePath));
        this.adjustText();
    }

    getText(start: number, end: number) {
        return this.text.substring(start, end);
    }

    getLength() {
        return this.text.length;
    }

    getFullText() {
        return this.text;
    }

    getChangeRange() {
        return undefined;
    }

    positionAt(offset: number) {
        return positionAt(offset, this.text, this.getLineOffsets());
    }

    offsetAt(position: Position): number {
        return offsetAt(position, this.text, this.getLineOffsets());
    }

    getGeneratedPosition(originalPosition: Position): Position {
        if (!this.kitFile || this.addedCode.length === 0) {
            return super.getGeneratedPosition(originalPosition);
        }
        const pos = this.originalOffsetAt(originalPosition);

        let total = 0;
        for (const added of this.addedCode) {
            if (pos < added.generatedPos) break;
            total += added.length;
        }

        return this.positionAt(pos + total);
    }

    getOriginalPosition(generatedPosition: Position): Position {
        if (!this.kitFile || this.addedCode.length === 0) {
            return super.getOriginalPosition(generatedPosition);
        }
        const pos = this.offsetAt(generatedPosition);

        let total = 0;
        let idx = 0;
        for (; idx < this.addedCode.length; idx++) {
            const added = this.addedCode[idx];
            if (pos < added.generatedPos) break;
            total += added.length;
        }

        if (idx > 0) {
            const prev = this.addedCode[idx - 1];
            // Special case: pos is in the middle of an added range
            if (pos > prev.generatedPos && pos < prev.generatedPos + prev.length) {
                return this.originalPositionAt(prev.originalPos);
            }
        }

        return this.originalPositionAt(pos - total);
    }

    update(changes: TextDocumentContentChangeEvent[]): void {
        for (const change of changes) {
            let start = 0;
            let end = 0;
            if ('range' in change) {
                start = this.originalOffsetAt(change.range.start);
                end = this.originalOffsetAt(change.range.end);
            } else {
                end = this.originalText.length;
            }

            this.originalText =
                this.originalText.slice(0, start) + change.text + this.originalText.slice(end);
        }

        this.adjustText();
        this.version++;
        this.lineOffsets = undefined;
        this.internalLineOffsets = undefined;
        // only client can have incremental updates
        this.openedByClient = true;
    }

    protected getLineOffsets() {
        if (!this.lineOffsets) {
            this.lineOffsets = getLineOffsets(this.text);
        }
        return this.lineOffsets;
    }

    private originalOffsetAt(position: Position): number {
        return offsetAt(position, this.originalText, this.getOriginalLineOffsets());
    }

    private originalPositionAt(offset: number): Position {
        return positionAt(offset, this.originalText, this.getOriginalLineOffsets());
    }

    private getOriginalLineOffsets() {
        if (!this.kitFile) {
            return this.getLineOffsets();
        }
        if (!this.internalLineOffsets) {
            this.internalLineOffsets = getLineOffsets(this.originalText);
        }
        return this.internalLineOffsets;
    }

    private adjustText() {
        const result = internalHelpers.upsertKitFile(
            ts,
            this.filePath,
            {
                clientHooksPath: this.clientHooksPath,
                paramsPath: this.paramsPath,
                serverHooksPath: this.serverHooksPath,
                universalHooksPath: this.universalHooksPath
            },
            () => this.createSource(),
            surroundWithIgnoreComments
        );
        if (!result) {
            this.kitFile = false;
            this.addedCode = [];
            this.text = this.originalText;
            return;
        }

        if (!this.kitFile) {
            const files = configLoader.getConfig(this.filePath)?.kit?.files;
            if (files) {
                this.paramsPath ||= files.params;
                this.serverHooksPath ||= files.hooks?.server;
                this.clientHooksPath ||= files.hooks?.client;
                this.universalHooksPath ||= files.hooks?.universal;
            }
        }

        const { text, addedCode } = result;

        this.kitFile = true;
        this.addedCode = addedCode;
        this.text = text;
    }

    private createSource() {
        return ts.createSourceFile(
            this.filePath,
            this.originalText,
            ts.ScriptTarget.Latest,
            true,
            this.scriptKind
        );
    }
}

const sourceMapCommentRegExp = /^\/\/[@#] source[M]appingURL=(.+)\r?\n?$/;
const whitespaceOrMapCommentRegExp = /^\s*(\/\/[@#] .*)?$/;
const base64UrlRegExp =
    /^data:(?:application\/json(?:;charset=[uU][tT][fF]-8);base64,([A-Za-z0-9+\/=]+)$)?/;

export class DtsDocumentSnapshot extends JSOrTSDocumentSnapshot implements DocumentMapper {
    private traceMap: TraceMap | undefined;
    private mapperInitialized = false;

    constructor(
        version: number,
        filePath: string,
        text: string,
        private tsSys: ts.System
    ) {
        super(version, filePath, text);
    }

    getOriginalFilePosition(generatedPosition: Position): FilePosition {
        if (!this.mapperInitialized) {
            this.traceMap = this.initMapper();
            this.mapperInitialized = true;
        }

        const mapped = this.traceMap
            ? originalPositionFor(this.traceMap, {
                  line: generatedPosition.line + 1,
                  column: generatedPosition.character
              })
            : undefined;

        if (!mapped || mapped.line == null || !mapped.source) {
            return generatedPosition;
        }

        const originalFilePath = URI.isUri(mapped.source)
            ? urlToPath(mapped.source)
            : this.filePath
              ? resolve(dirname(this.filePath), mapped.source).toString()
              : undefined;

        // ex: library publish with declarationMap but npmignore the original files
        if (!originalFilePath || !this.tsSys.fileExists(originalFilePath)) {
            return generatedPosition;
        }

        return {
            line: mapped.line - 1,
            character: mapped.column,
            uri: pathToUrl(originalFilePath)
        };
    }

    private initMapper() {
        const sourceMapUrl = tryGetSourceMappingURL(this.getLineOffsets(), this.getFullText());

        if (!sourceMapUrl) {
            return;
        }

        const match = sourceMapUrl.match(base64UrlRegExp);
        if (match) {
            const base64Json = match[1];
            if (!base64Json || !this.tsSys.base64decode) {
                return;
            }

            return this.initMapperByRawSourceMap(this.tsSys.base64decode(base64Json));
        }

        const tryingLocations = new Set([
            resolve(dirname(this.filePath), sourceMapUrl),
            this.filePath + '.map'
        ]);

        for (const mapFilePath of tryingLocations) {
            if (!this.tsSys.fileExists(mapFilePath)) {
                continue;
            }

            const mapFileContent = this.tsSys.readFile(mapFilePath);
            if (mapFileContent) {
                return this.initMapperByRawSourceMap(mapFileContent);
            }
        }

        this.logFailedToResolveSourceMap("can't find valid sourcemap file");
    }

    private initMapperByRawSourceMap(input: string) {
        const map = tryParseRawSourceMap(input);

        // don't support inline sourcemap because
        // it must be a file that editor can point to
        if (
            !map ||
            !map.mappings ||
            map.sourcesContent?.some((content) => typeof content === 'string')
        ) {
            this.logFailedToResolveSourceMap('invalid or unsupported sourcemap');
            return;
        }

        return new TraceMap(map);
    }

    private logFailedToResolveSourceMap(...errors: any[]) {
        Logger.debug(`Resolving declaration map for ${this.filePath} failed. `, ...errors);
    }
}

// https://github.com/microsoft/TypeScript/blob/1dc5b28b94b4a63f735a42d6497d538434d69b66/src/compiler/sourcemap.ts#L381
function tryGetSourceMappingURL(lineOffsets: number[], text: string) {
    for (let index = lineOffsets.length - 1; index >= 0; index--) {
        const line = text.slice(lineOffsets[index], lineOffsets[index + 1]);
        const comment = sourceMapCommentRegExp.exec(line);
        if (comment) {
            return comment[1].trimEnd();
        }
        // If we see a non-whitespace/map comment-like line, break, to avoid scanning up the entire file
        else if (!line.match(whitespaceOrMapCommentRegExp)) {
            break;
        }
    }
}

// https://github.com/microsoft/TypeScript/blob/1dc5b28b94b4a63f735a42d6497d538434d69b66/src/compiler/sourcemap.ts#L402

function isRawSourceMap(x: any): x is EncodedSourceMap {
    return (
        x !== null &&
        typeof x === 'object' &&
        x.version === 3 &&
        typeof x.file === 'string' &&
        typeof x.mappings === 'string' &&
        Array.isArray(x.sources) &&
        x.sources.every((source: any) => typeof source === 'string') &&
        (x.sourceRoot === undefined || x.sourceRoot === null || typeof x.sourceRoot === 'string') &&
        (x.sourcesContent === undefined ||
            x.sourcesContent === null ||
            (Array.isArray(x.sourcesContent) &&
                x.sourcesContent.every(
                    (content: any) => typeof content === 'string' || content === null
                ))) &&
        (x.names === undefined ||
            x.names === null ||
            (Array.isArray(x.names) && x.names.every((name: any) => typeof name === 'string')))
    );
}

function tryParseRawSourceMap(text: string) {
    try {
        const parsed = JSON.parse(text);
        if (isRawSourceMap(parsed)) {
            return parsed;
        }
    } catch {
        // empty
    }

    return undefined;
}
