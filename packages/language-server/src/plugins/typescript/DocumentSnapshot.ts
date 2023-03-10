import { EncodedSourceMap, TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import path from 'path';
import { walk } from 'svelte/compiler';
import { TemplateNode } from 'svelte/types/compiler/interfaces';
import { svelte2tsx, IExportedNames } from 'svelte2tsx';
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
import { SvelteNode } from './svelte-ast-utils';
import {
    getScriptKindFromAttributes,
    getScriptKindFromFileName,
    isSvelteFilePath,
    getTsCheckComment,
    findExports
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
}

/**
 * Options that apply to svelte files.
 */
export interface SvelteSnapshotOptions {
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
            return DocumentSnapshot.fromSvelteFilePath(filePath, createDocument, options);
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
        if (
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
        options: SvelteSnapshotOptions
    ) {
        const originalText = ts.sys.readFile(filePath) ?? '';
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

    constructor(
        public readonly parent: Document,
        public readonly parserError: ParserError | null,
        public readonly scriptKind: ts.ScriptKind,
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
        walk(this.htmlAst, {
            enter(node) {
                // In case the offset is at a point where a node ends and a new one begins,
                // the node where the code ends is used. If this introduces problems, introduce
                // an affinity parameter to prefer the node where it ends/starts.
                if ((node as SvelteNode).start > offset || (node as SvelteNode).end < offset) {
                    this.skip();
                    return;
                }
                const parent = foundNode;
                // Spread so the "parent" property isn't added to the original ast,
                // causing an infinite loop
                foundNode = { ...node } as SvelteNode;
                if (parent) {
                    foundNode.parent = parent;
                }
            }
        });

        return foundNode;
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

const kitPageFiles = new Set(['+page', '+layout', '+page.server', '+layout.server', '+server']);

export function isKitFile(
    fileName: string,
    serverHooksPath: string,
    clientHooksPath: string,
    paramsPath: string
) {
    const basename = path.basename(fileName);
    return (
        isKitRouteFile(fileName, basename) ||
        isServerHooksFile(fileName, basename, serverHooksPath) ||
        isClientHooksFile(fileName, basename, clientHooksPath) ||
        isParamsFile(fileName, basename, paramsPath)
    );
}

function isKitRouteFile(fileName: string, basename: string) {
    if (basename.includes('@')) {
        // +page@foo -> +page
        basename = basename.split('@')[0];
    } else {
        basename = basename.slice(0, -path.extname(fileName).length);
    }

    return kitPageFiles.has(basename);
}

function isServerHooksFile(fileName: string, basename: string, serverHooksPath: string) {
    return (
        ((basename === 'index.ts' || basename === 'index.js') &&
            fileName.slice(0, -basename.length - 1).endsWith(serverHooksPath)) ||
        fileName.slice(0, -path.extname(basename).length).endsWith(serverHooksPath)
    );
}

function isClientHooksFile(fileName: string, basename: string, clientHooksPath: string) {
    return (
        ((basename === 'index.ts' || basename === 'index.js') &&
            fileName.slice(0, -basename.length - 1).endsWith(clientHooksPath)) ||
        fileName.slice(0, -path.extname(basename).length).endsWith(clientHooksPath)
    );
}

function isParamsFile(fileName: string, basename: string, paramsPath: string) {
    return (
        fileName.slice(0, -basename.length - 1).endsWith(paramsPath) &&
        !basename.includes('.test') &&
        !basename.includes('.spec')
    );
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

    constructor(public version: number, public readonly filePath: string, private text: string) {
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
        this.addedCode = [];
        this.text = this.upsertKitFile(this.filePath) ?? this.originalText;
    }

    private upsertKitFile(fileName: string) {
        let basename = path.basename(fileName);
        const result =
            this.upserKitRouteFile(fileName, basename) ??
            this.upserKitServerHooksFile(fileName, basename) ??
            this.upserKitClientHooksFile(fileName, basename) ??
            this.upserKitParamsFile(fileName, basename);
        if (!result) {
            return;
        }

        if (!this.kitFile) {
            const files = configLoader.getConfig(this.filePath)?.kit?.files;
            if (files) {
                this.paramsPath ||= files.params;
                this.serverHooksPath ||= files.hooks?.server;
                this.clientHooksPath ||= files.hooks?.client;
            }
        }

        this.kitFile = true;

        // construct generated text from internal text and addedCode array
        let pos = 0;
        let text = '';
        for (const added of this.addedCode) {
            text += this.originalText.slice(pos, added.originalPos) + added.inserted;
            pos = added.originalPos;
        }
        text += this.originalText.slice(pos);
        return text;
    }

    private upserKitRouteFile(fileName: string, basename: string) {
        if (basename.includes('@')) {
            // +page@foo -> +page
            basename = basename.split('@')[0];
        } else {
            basename = basename.slice(0, -path.extname(fileName).length);
        }
        if (!kitPageFiles.has(basename)) return;

        const source = this.createSource();

        this.addedCode = [];
        const insert = (pos: number, inserted: string) => {
            this.insertCode(this.addedCode, pos, inserted);
        };

        const isTsFile = basename.endsWith('.ts');
        const allExports = findExports(source, isTsFile);

        // add type to load function if not explicitly typed
        const load = allExports.get('load');
        if (
            load?.type === 'function' &&
            load.node.parameters.length === 1 &&
            !load.hasTypeDefinition
        ) {
            const pos = load.node.parameters[0].getEnd();
            const inserted = surroundWithIgnoreComments(
                `: import('./$types').${basename.includes('layout') ? 'Layout' : 'Page'}${
                    basename.includes('server') ? 'Server' : ''
                }LoadEvent`
            );

            insert(pos, inserted);
        }

        // add type to actions variable if not explicitly typed
        const actions = allExports.get('actions');
        if (actions?.type === 'var' && !actions.hasTypeDefinition && actions.node.initializer) {
            const pos = actions.node.initializer.getEnd();
            const inserted = surroundWithIgnoreComments(` satisfies import('./$types').Actions`);
            insert(pos, inserted);
        }

        // add type to prerender variable if not explicitly typed
        const prerender = allExports.get('prerender');
        if (
            prerender?.type === 'var' &&
            !prerender.hasTypeDefinition &&
            prerender.node.initializer
        ) {
            const pos = prerender.node.name.getEnd();
            const inserted = surroundWithIgnoreComments(` : boolean | 'auto'`);
            insert(pos, inserted);
        }

        // add type to trailingSlash variable if not explicitly typed
        const trailingSlash = allExports.get('trailingSlash');
        if (
            trailingSlash?.type === 'var' &&
            !trailingSlash.hasTypeDefinition &&
            trailingSlash.node.initializer
        ) {
            const pos = trailingSlash.node.name.getEnd();
            const inserted = surroundWithIgnoreComments(` : 'never' | 'always' | 'ignore'`);
            insert(pos, inserted);
        }

        // add type to ssr variable if not explicitly typed
        const ssr = allExports.get('ssr');
        if (ssr?.type === 'var' && !ssr.hasTypeDefinition && ssr.node.initializer) {
            const pos = ssr.node.name.getEnd();
            const inserted = surroundWithIgnoreComments(` : boolean`);
            insert(pos, inserted);
        }

        // add type to csr variable if not explicitly typed
        const csr = allExports.get('csr');
        if (csr?.type === 'var' && !csr.hasTypeDefinition && csr.node.initializer) {
            const pos = csr.node.name.getEnd();
            const inserted = surroundWithIgnoreComments(` : boolean`);
            insert(pos, inserted);
        }

        // add types to GET/PUT/POST/PATCH/DELETE/OPTIONS if not explicitly typed
        const insertApiMethod = (name: string) => {
            const api = allExports.get(name);
            if (
                api?.type === 'function' &&
                api.node.parameters.length === 1 &&
                !api.hasTypeDefinition
            ) {
                const pos = api.node.parameters[0].getEnd();
                const inserted = surroundWithIgnoreComments(`: import('./$types').RequestHandler`);

                insert(pos, inserted);
            }
        };
        insertApiMethod('GET');
        insertApiMethod('PUT');
        insertApiMethod('POST');
        insertApiMethod('PATCH');
        insertApiMethod('DELETE');
        insertApiMethod('OPTIONS');

        return true;
    }

    private upserKitParamsFile(fileName: string, basename: string) {
        if (
            !fileName.slice(0, -basename.length - 1).endsWith(this.paramsPath) ||
            basename.includes('.test') ||
            basename.includes('.spec')
        ) {
            return;
        }

        const source = this.createSource();

        this.addedCode = [];
        const insert = (pos: number, inserted: string) => {
            this.insertCode(this.addedCode, pos, inserted);
        };

        const isTsFile = basename.endsWith('.ts');
        const allExports = findExports(source, isTsFile);

        // add type to match function if not explicitly typed
        const match = allExports.get('match');
        if (
            match?.type === 'function' &&
            match.node.parameters.length === 1 &&
            !match.hasTypeDefinition
        ) {
            const pos = match.node.parameters[0].getEnd();
            const inserted = surroundWithIgnoreComments(`: string`);
            insert(pos, inserted);
            if (!match.node.type && match.node.body) {
                const returnPos = match.node.body.getStart();
                const returnInsertion = surroundWithIgnoreComments(`: boolean`);
                insert(returnPos, returnInsertion);
            }
        }

        return true;
    }

    private upserKitClientHooksFile(fileName: string, basename: string) {
        const matchesHooksFile =
            ((basename === 'index.ts' || basename === 'index.js') &&
                fileName.slice(0, -basename.length - 1).endsWith(this.clientHooksPath)) ||
            fileName.slice(0, -path.extname(basename).length).endsWith(this.clientHooksPath);
        if (!matchesHooksFile) {
            return;
        }

        const source = this.createSource();

        this.addedCode = [];
        const insert = (pos: number, inserted: string) => {
            this.insertCode(this.addedCode, pos, inserted);
        };

        const isTsFile = basename.endsWith('.ts');
        const allExports = findExports(source, isTsFile);

        // add type to handleError function if not explicitly typed
        const handleError = allExports.get('handleError');
        if (
            handleError?.type === 'function' &&
            handleError.node.parameters.length === 1 &&
            !handleError.hasTypeDefinition
        ) {
            const paramPos = handleError.node.parameters[0].getEnd();
            const paramInsertion = surroundWithIgnoreComments(
                `: Parameters<import('@sveltejs/kit').HandleClientError>[0]`
            );
            insert(paramPos, paramInsertion);
            if (!handleError.node.type && handleError.node.body) {
                const returnPos = handleError.node.body.getStart();
                const returnInsertion = surroundWithIgnoreComments(
                    `: ReturnType<import('@sveltejs/kit').HandleClientError>`
                );
                insert(returnPos, returnInsertion);
            }
        }

        return { addedCode: this.addedCode, originalText: this.originalText };
    }

    private upserKitServerHooksFile(fileName: string, basename: string) {
        const matchesHooksFile =
            ((basename === 'index.ts' || basename === 'index.js') &&
                fileName.slice(0, -basename.length - 1).endsWith(this.serverHooksPath)) ||
            fileName.slice(0, -path.extname(basename).length).endsWith(this.serverHooksPath);
        if (!matchesHooksFile) {
            return;
        }

        const source = this.createSource();

        this.addedCode = [];
        const insert = (pos: number, inserted: string) => {
            this.insertCode(this.addedCode, pos, inserted);
        };

        const isTsFile = basename.endsWith('.ts');
        const allExports = findExports(source, isTsFile);

        const addTypeToFunction = (name: string, type: string) => {
            const fn = allExports.get(name);
            if (
                fn?.type === 'function' &&
                fn.node.parameters.length === 1 &&
                !fn.hasTypeDefinition
            ) {
                const paramPos = fn.node.parameters[0].getEnd();
                const paramInsertion = surroundWithIgnoreComments(`: Parameters<${type}>[0]`);
                insert(paramPos, paramInsertion);
                if (!fn.node.type && fn.node.body) {
                    const returnPos = fn.node.body.getStart();
                    const returnInsertion = surroundWithIgnoreComments(`: ReturnType<${type}>`);
                    insert(returnPos, returnInsertion);
                }
            }
        };

        addTypeToFunction('handleError', `import('@sveltejs/kit').HandleServerError`);
        addTypeToFunction('handle', `import('@sveltejs/kit').Handle`);
        addTypeToFunction('handleFetch', `import('@sveltejs/kit').HandleFetch`);

        return true;
    }

    private insertCode(addedCode: typeof this.addedCode, pos: number, inserted: string) {
        const insertionIdx = addedCode.findIndex((c) => c.originalPos > pos);
        if (insertionIdx >= 0) {
            for (let i = insertionIdx; i < addedCode.length; i++) {
                addedCode[i].generatedPos += inserted.length;
                addedCode[i].total += inserted.length;
            }
            const prevTotal = addedCode[insertionIdx - 1]?.total ?? 0;
            addedCode.splice(insertionIdx, 0, {
                generatedPos: pos + prevTotal,
                originalPos: pos,
                length: inserted.length,
                inserted,
                total: prevTotal + inserted.length
            });
        } else {
            const prevTotal = addedCode[addedCode.length - 1]?.total ?? 0;
            addedCode.push({
                generatedPos: pos + prevTotal,
                originalPos: pos,
                length: inserted.length,
                inserted,
                total: prevTotal + inserted.length
            });
        }
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

    constructor(version: number, filePath: string, text: string, private tsSys: ts.System) {
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
            line: mapped.line,
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
