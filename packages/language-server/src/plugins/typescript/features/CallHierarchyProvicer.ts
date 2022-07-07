import path, { basename, dirname } from 'path';
import ts from 'typescript';
import { CancellationToken, Range, SymbolTag } from 'vscode-languageserver';
import {
    CallHierarchyIncomingCall,
    CallHierarchyItem,
    CallHierarchyOutgoingCall,
    Position
} from 'vscode-languageserver-types';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { LSConfigManager } from '../../../ls-config';
import { isNotNullOrUndefined, pathToUrl, urlToPath } from '../../../utils';
import { CallHierarchyProvider } from '../../interfaces';
import { DocumentSnapshot, SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import {
    convertRange,
    isGeneratedSvelteComponentName,
    isSvelteFilePath,
    offsetOfGeneratedComponentExport,
    symbolKindFromString,
    toGeneratedSvelteComponentName
} from '../utils';
import { findContainingNode, findNodeAtSpan, SnapshotMap } from './utils';

export class CallHierarchyProviderImpl implements CallHierarchyProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager,
        private readonly workspaceUris: string[]
    ) {}

    async prepareCallHierarchy(
        document: Document,
        position: Position,
        cancellationToken?: CancellationToken
    ): Promise<CallHierarchyItem[] | null> {
        const { lang, tsDoc } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);

        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));
        const items = lang.prepareCallHierarchy(tsDoc.filePath, offset);

        const itemsArray = Array.isArray(items) ? items : items ? [items] : [];

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver);
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
        const nearestRoot = Array.from(this.workspaceUris)
            .map((uri) => urlToPath(uri))
            .filter(isNotNullOrUndefined)
            .sort((path) => path.length)
            .find((path) => item.file.startsWith(path));

        const name = useFileName ? basename(item.file) : item.name;
        const detail = useFileName
            ? nearestRoot && path.relative(nearestRoot, dirname(item.file))
            : item.containerName;
        return { name, detail };
    }

    async getInComingCalls(
        previousItem: CallHierarchyItem,
        cancellationToken?: CancellationToken | undefined
    ): Promise<CallHierarchyIncomingCall[] | null> {
        const prepareResult = await this.prepareFurtherCalls(previousItem, cancellationToken);
        if (!prepareResult) {
            return null;
        }

        const { lang, filePath, program, snapshots, offset } = prepareResult;

        let incomingCalls: ts.CallHierarchyIncomingCall[] = lang.provideCallHierarchyIncomingCalls(
            filePath,
            offset
        );

        if (this.configManager.getConfig().svelte.useNewTransformation) {
            incomingCalls = incomingCalls.concat(
                this.getInComingCallsForNewTransformationComponent(
                    lang,
                    program,
                    filePath,
                    offset
                ) ?? []
            );
        }

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

    async getOutComingCalls(
        previousItem: CallHierarchyItem,
        cancellationToken?: CancellationToken | undefined
    ): Promise<CallHierarchyOutgoingCall[] | null> {
        const prepareResult = await this.prepareFurtherCalls(previousItem, cancellationToken);
        if (!prepareResult) {
            return null;
        }

        const { lang, filePath, program, snapshots, offset } = prepareResult;

        const outgoingCalls = lang.provideCallHierarchyOutgoingCalls(filePath, offset);

        const result = await Promise.all(
            outgoingCalls.map(async (item): Promise<CallHierarchyOutgoingCall | null> => {
                const snapshot = await snapshots.retrieve(item.to.file);
                const to = await this.convertCallHierarchyItem(snapshots, item.to, program);

                if (!to) {
                    return null;
                }
                return {
                    to,
                    fromRanges: this.convertFromRanges(snapshot, item.fromSpans)
                };
            })
        );

        return result.filter(isNotNullOrUndefined);
    }

    private async prepareFurtherCalls(
        item: CallHierarchyItem,
        cancellationToken: CancellationToken | undefined
    ) {
        const filePath = urlToPath(item.uri);

        if (!filePath) {
            return null;
        }

        const lang = await this.lsAndTsDocResolver.getLSForPath(filePath);
        const tsDoc = await this.lsAndTsDocResolver.getSnapshot(filePath);

        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        const program = lang.getProgram();

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver);
        snapshots.set(tsDoc.filePath, tsDoc);

        const isSvelteCompRange =
            isSvelteFilePath(item.name) &&
            item.selectionRange.start.line === 0 &&
            item.range.start.line === 0 &&
            tsDoc instanceof SvelteDocumentSnapshot;
        const componentExportOffset = isSvelteCompRange
            ? offsetOfGeneratedComponentExport(tsDoc)
            : -1;

        const offset =
            componentExportOffset >= 0
                ? componentExportOffset
                : tsDoc.offsetAt(tsDoc.getGeneratedPosition(item.selectionRange.start));

        return {
            snapshots,
            filePath,
            program,
            tsDoc,
            lang,
            offset
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
            const renderFunction = findContainingNode(
                sourceFile,
                item.selectionSpan,
                ts.isFunctionDeclaration
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
        const fileRange = Range.create(
            Position.create(0, 0),
            snapshot.parent.positionAt(snapshot.parent.getTextLength())
        );

        return {
            ...this.getNameAndDetailForItem(true, item),
            kind: symbolKindFromString(ts.ScriptElementKind.scriptElement),
            range: fileRange,
            selectionRange: fileRange,
            uri: pathToUrl(item.file)
        };
    }

    private convertFromRanges(snapshot: DocumentSnapshot, spans: ts.TextSpan[]) {
        return spans.map((item) => mapRangeToOriginal(snapshot, convertRange(snapshot, item)));
    }

    private getInComingCallsForNewTransformationComponent(
        lang: ts.LanguageService,
        program: ts.Program | undefined,
        filePath: string,
        offset: number
    ): Array<ts.CallHierarchyIncomingCall & { isComponent: true }> | null {
        if (!program) {
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
                isComponent: true,
                from: {
                    file,
                    kind: ts.ScriptElementKind.scriptElement,
                    name: toGeneratedSvelteComponentName(''),
                    // doesn't matter, will be override later
                    selectionSpan: { start: 0, length: 0 },
                    span: { start: 0, length: 0 }
                },
                fromSpans: group.map((g) => g.ref.textSpan)
            })) ?? null
        );
    }

    private getComponentStartTagFromReference(
        program: ts.Program,
        ref: ts.ReferenceEntry
    ): { node: ts.Node; ref: ts.ReferenceEntry } | null {
        const sourceFile = program.getSourceFile(ref.fileName);

        if (!sourceFile) {
            return null;
        }

        const node = findNodeAtSpan(sourceFile, ref.textSpan);

        if (
            node &&
            ts.isCallExpression(node.parent) &&
            node.parent.expression.getText() === '__sveltets_2_ensureComponent'
        ) {
            return { node, ref };
        }

        return null;
    }
}
