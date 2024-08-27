import path, { basename, dirname } from 'path';
import ts from 'typescript';
import { CancellationToken, Range, SymbolKind, SymbolTag } from 'vscode-languageserver';
import {
    CallHierarchyIncomingCall,
    CallHierarchyItem,
    CallHierarchyOutgoingCall,
    Position
} from 'vscode-languageserver-types';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import {
    createGetCanonicalFileName,
    isNotNullOrUndefined,
    pathToUrl,
    urlToPath
} from '../../../utils';
import { CallHierarchyProvider } from '../../interfaces';
import { DocumentSnapshot, SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import {
    convertRange,
    getNearestWorkspaceUri,
    isGeneratedSvelteComponentName,
    isSvelteFilePath,
    offsetOfGeneratedComponentExport,
    symbolKindFromString,
    toGeneratedSvelteComponentName
} from '../utils';
import { findNodeAtSpan, gatherDescendants, SnapshotMap } from './utils';

const ENSURE_COMPONENT_HELPER = '__sveltets_2_ensureComponent';

export class CallHierarchyProviderImpl implements CallHierarchyProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly workspaceUris: string[]
    ) {}

    async prepareCallHierarchy(
        document: Document,
        position: Position,
        cancellationToken?: CancellationToken
    ): Promise<CallHierarchyItem[] | null> {
        const { lang, tsDoc, lsContainer } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);

        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));
        const items = lang.prepareCallHierarchy(tsDoc.filePath, offset);

        const itemsArray = Array.isArray(items) ? items : items ? [items] : [];

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver, lsContainer);
        snapshots.set(tsDoc.filePath, tsDoc);

        const program = lang.getProgram();
        const result = await Promise.all(
            itemsArray.map((item) => this.convertCallHierarchyItem(snapshots, item, program))
        );

        return result.filter(isNotNullOrUndefined);
    }

    private isSourceFileItem(item: ts.CallHierarchyItem) {
        return (
            item.kind === ts.ScriptElementKind.scriptElement ||
            (item.kind === ts.ScriptElementKind.moduleElement && item.selectionSpan.start === 0)
        );
    }

    private async convertCallHierarchyItem(
        snapshots: SnapshotMap,
        item: ts.CallHierarchyItem,
        program: ts.Program | undefined
    ): Promise<CallHierarchyItem | null> {
        const snapshot = await snapshots.retrieve(item.file);

        const redirectedCallHierarchyItem = this.redirectCallHierarchyItem(snapshot, program, item);

        if (redirectedCallHierarchyItem) {
            return redirectedCallHierarchyItem;
        }

        const { name, detail } = this.getNameAndDetailForItem(this.isSourceFileItem(item), item);

        const selectionRange = mapRangeToOriginal(
            snapshot,
            convertRange(snapshot, item.selectionSpan)
        );

        if (selectionRange.start.line < 0 || selectionRange.end.line < 0) {
            return null;
        }

        const range = mapRangeToOriginal(snapshot, convertRange(snapshot, item.span));

        if (range.start.line < 0 || range.end.line < 0) {
            return null;
        }

        return {
            kind: symbolKindFromString(item.kind),
            name,
            range,
            selectionRange,
            uri: pathToUrl(item.file),
            detail,
            tags: item.kindModifiers?.includes('deprecated') ? [SymbolTag.Deprecated] : undefined
        };
    }

    private getNameAndDetailForItem(useFileName: boolean, item: ts.CallHierarchyItem) {
        const nearestRootUri = getNearestWorkspaceUri(
            this.workspaceUris,
            item.file,
            createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames)
        );
        const nearestRoot = nearestRootUri && (urlToPath(nearestRootUri) ?? undefined);

        const name = useFileName ? basename(item.file) : item.name;
        const detail = useFileName
            ? nearestRoot && path.relative(nearestRoot, dirname(item.file))
            : item.containerName;
        return { name, detail };
    }

    async getIncomingCalls(
        previousItem: CallHierarchyItem,
        cancellationToken?: CancellationToken | undefined
    ): Promise<CallHierarchyIncomingCall[] | null> {
        const prepareResult = await this.prepareFurtherCalls(previousItem, cancellationToken);
        if (!prepareResult) {
            return null;
        }

        const {
            lang,
            filePath,
            program,
            snapshots,
            isComponentModulePosition,
            tsDoc,
            getNonComponentOffset
        } = prepareResult;

        const componentExportOffset =
            isComponentModulePosition && tsDoc instanceof SvelteDocumentSnapshot
                ? offsetOfGeneratedComponentExport(tsDoc)
                : -1;
        const offset = componentExportOffset >= 0 ? componentExportOffset : getNonComponentOffset();

        const incomingCalls: ts.CallHierarchyIncomingCall[] = lang
            .provideCallHierarchyIncomingCalls(filePath, offset)
            .concat(this.getInComingCallsForComponent(lang, program, filePath, offset) ?? []);

        const result = await Promise.all(
            incomingCalls.map(async (item): Promise<CallHierarchyIncomingCall | null> => {
                const snapshot = await snapshots.retrieve(item.from.file);
                const from = await this.convertCallHierarchyItem(snapshots, item.from, program);

                if (!from) {
                    return null;
                }

                return {
                    from,
                    fromRanges: this.convertFromRanges(snapshot, item.fromSpans)
                };
            })
        );

        return result.filter(isNotNullOrUndefined);
    }

    async getOutgoingCalls(
        previousItem: CallHierarchyItem,
        cancellationToken?: CancellationToken | undefined
    ): Promise<CallHierarchyOutgoingCall[] | null> {
        const prepareResult = await this.prepareFurtherCalls(previousItem, cancellationToken);
        if (!prepareResult) {
            return null;
        }

        const {
            lang,
            filePath,
            program,
            snapshots,
            isComponentModulePosition,
            tsDoc,
            getNonComponentOffset
        } = prepareResult;

        const sourceFile = program?.getSourceFile(filePath);
        const renderFunctionOffset =
            isComponentModulePosition && tsDoc instanceof SvelteDocumentSnapshot && sourceFile
                ? sourceFile.statements
                      .find(
                          (statement): statement is ts.FunctionDeclaration =>
                              ts.isFunctionDeclaration(statement) &&
                              statement.name?.getText() === 'render'
                      )
                      ?.name?.getStart()
                : -1;
        const offset =
            renderFunctionOffset != null && renderFunctionOffset >= 0
                ? renderFunctionOffset
                : getNonComponentOffset();

        const outgoingCalls = lang
            .provideCallHierarchyOutgoingCalls(filePath, offset)
            .concat(
                isComponentModulePosition
                    ? (this.getOutgoingCallsForComponent(program, filePath) ?? [])
                    : []
            );

        const result = await Promise.all(
            outgoingCalls.map(async (item): Promise<CallHierarchyOutgoingCall | null> => {
                if (
                    item.to.name.startsWith('__sveltets') ||
                    item.to.containerName === 'svelteHTML'
                ) {
                    return null;
                }

                const to = await this.convertCallHierarchyItem(snapshots, item.to, program);

                if (!to) {
                    return null;
                }
                return {
                    to,
                    fromRanges: this.convertFromRanges(tsDoc, item.fromSpans)
                };
            })
        );

        return result.filter(isNotNullOrUndefined).filter((item) => item.fromRanges.length);
    }

    private async prepareFurtherCalls(
        item: CallHierarchyItem,
        cancellationToken: CancellationToken | undefined
    ) {
        const filePath = urlToPath(item.uri);

        if (!filePath) {
            return null;
        }

        const lsContainer = await this.lsAndTsDocResolver.getTSService(filePath);
        const lang = lsContainer.getService();
        const tsDoc = await this.lsAndTsDocResolver.getOrCreateSnapshot(filePath);

        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        const program = lang.getProgram();

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver, lsContainer);
        snapshots.set(tsDoc.filePath, tsDoc);

        const isComponentModulePosition =
            isSvelteFilePath(item.name) &&
            item.selectionRange.start.line === 0 &&
            item.range.start.line === 0;

        return {
            snapshots,
            filePath,
            program,
            tsDoc,
            lang,
            isComponentModulePosition,
            getNonComponentOffset: () =>
                tsDoc.offsetAt(tsDoc.getGeneratedPosition(item.selectionRange.start))
        };
    }

    private redirectCallHierarchyItem(
        snapshot: DocumentSnapshot,
        program: ts.Program | undefined,
        item: ts.CallHierarchyItem
    ): CallHierarchyItem | null {
        if (
            !isSvelteFilePath(item.file) ||
            !program ||
            !(snapshot instanceof SvelteDocumentSnapshot)
        ) {
            return null;
        }

        const sourceFile = program.getSourceFile(item.file);

        if (!sourceFile) {
            return null;
        }

        if (isGeneratedSvelteComponentName(item.name)) {
            return this.toComponentCallHierarchyItem(snapshot, item);
        }

        if (item.name === 'render') {
            const end = item.selectionSpan.start + item.selectionSpan.length;
            const renderFunction = sourceFile.statements.find(
                (statement) =>
                    statement.getStart() <= item.selectionSpan.start && statement.getEnd() >= end
            );

            if (!renderFunction || !sourceFile.statements.includes(renderFunction)) {
                return null;
            }
            return this.toComponentCallHierarchyItem(snapshot, item);
        }

        return null;
    }

    private toComponentCallHierarchyItem(
        snapshot: SvelteDocumentSnapshot,
        item: ts.CallHierarchyItem
    ) {
        const fileStartPosition = Position.create(0, 0);
        const fileRange = Range.create(
            fileStartPosition,
            snapshot.parent.positionAt(snapshot.parent.getTextLength())
        );

        return {
            ...this.getNameAndDetailForItem(true, item),
            kind: SymbolKind.Module,
            range: fileRange,
            selectionRange: Range.create(fileStartPosition, fileStartPosition),
            uri: pathToUrl(item.file)
        };
    }

    private convertFromRanges(snapshot: DocumentSnapshot, spans: ts.TextSpan[]) {
        return spans
            .map((item) => mapRangeToOriginal(snapshot, convertRange(snapshot, item)))
            .filter((range) => range.start.line >= 0 && range.end.line >= 0);
    }

    private getInComingCallsForComponent(
        lang: ts.LanguageService,
        program: ts.Program | undefined,
        filePath: string,
        offset: number
    ): ts.CallHierarchyIncomingCall[] | null {
        if (!program || !isSvelteFilePath(filePath)) {
            return null;
        }

        const groups = lang
            .findReferences(filePath, offset)
            ?.map(
                (entry) =>
                    [
                        entry.definition.fileName,
                        entry.references
                            .map((ref) => this.getComponentStartTagFromReference(program, ref))
                            .filter(isNotNullOrUndefined)
                    ] as const
            )
            .filter(([_, group]) => group.length);

        return (
            groups?.map(([file, group]) => ({
                from: {
                    file,
                    kind: ts.ScriptElementKind.scriptElement,
                    name: toGeneratedSvelteComponentName(''),
                    // doesn't matter, will be override later
                    selectionSpan: { start: 0, length: 0 },
                    span: { start: 0, length: 0 }
                },
                fromSpans: group.map((g) => g.textSpan)
            })) ?? null
        );
    }

    private getComponentStartTagFromReference(
        program: ts.Program,
        ref: ts.ReferenceEntry
    ): ts.ReferenceEntry | null {
        const sourceFile = program.getSourceFile(ref.fileName);

        if (!sourceFile) {
            return null;
        }

        const node = findNodeAtSpan(sourceFile, ref.textSpan, this.isComponentStartTag);

        if (node) {
            return ref;
        }

        return null;
    }

    private isComponentStartTag(node: ts.Node | undefined): node is ts.Identifier {
        return (
            !!node &&
            node.parent &&
            ts.isCallExpression(node.parent) &&
            ts.isIdentifier(node.parent.expression) &&
            node.parent.expression.text === ENSURE_COMPONENT_HELPER &&
            ts.isIdentifier(node) &&
            node === node.parent.arguments[0]
        );
    }

    private getOutgoingCallsForComponent(
        program: ts.Program | undefined,
        filePath: string
    ): ts.CallHierarchyOutgoingCall[] | null {
        const sourceFile = program?.getSourceFile(filePath);
        if (!program || !sourceFile) {
            return null;
        }

        const groups = new Map<ts.ClassDeclaration, ts.TextSpan[]>();

        const startTags = gatherDescendants(sourceFile, this.isComponentStartTag);
        const typeChecker = program.getTypeChecker();

        for (const startTag of startTags) {
            const type = typeChecker.getTypeAtLocation(startTag);
            const symbol = type.aliasSymbol ?? type.symbol;
            const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];

            if (!declaration || !ts.isClassDeclaration(declaration)) {
                continue;
            }

            let group = groups.get(declaration);

            if (!group) {
                group = [];
                groups.set(declaration, group);
            }

            group.push({ start: startTag.getStart(), length: startTag.getWidth() });
        }

        return (
            Array.from(groups).map(([declaration, group]) => {
                const file = declaration.getSourceFile().fileName;
                const name = declaration.name?.getText() ?? basename(file);
                const span = { start: declaration.getStart(), length: declaration.getWidth() };
                const selectionSpan = declaration.name
                    ? { start: declaration.name.getStart(), length: declaration.name.getWidth() }
                    : span;

                return {
                    to: {
                        file,
                        kind: ts.ScriptElementKind.classElement,
                        name,
                        selectionSpan,
                        span
                    },
                    fromSpans: group
                };
            }) ?? null
        );
    }
}
