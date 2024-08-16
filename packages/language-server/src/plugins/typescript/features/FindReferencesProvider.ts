import ts from 'typescript';
import { CancellationToken, Location, Position, ReferenceContext } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { flatten, isNotNullOrUndefined, normalizePath, pathToUrl } from '../../../utils';
import { FindComponentReferencesProvider, FindReferencesProvider } from '../../interfaces';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import {
    convertToLocationForReferenceOrDefinition,
    hasNonZeroRange,
    isGeneratedSvelteComponentName
} from '../utils';
import {
    get$storeOffsetOf$storeDeclaration,
    getStoreOffsetOf$storeDeclaration,
    is$storeVariableIn$storeDeclaration,
    isStoreVariableIn$storeDeclaration,
    isTextSpanInGeneratedCode,
    SnapshotMap
} from './utils';

export class FindReferencesProviderImpl implements FindReferencesProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly componentReferencesProvider: FindComponentReferencesProvider
    ) {}

    async findReferences(
        document: Document,
        position: Position,
        context: ReferenceContext,
        cancellationToken?: CancellationToken
    ): Promise<Location[] | null> {
        if (
            this.isPositionForComponentCodeLens(position) ||
            this.isScriptStartOrEndTag(position, document)
        ) {
            return this.componentReferencesProvider.findComponentReferences(document.uri);
        }

        const { lang, tsDoc, lsContainer } = await this.getLSAndTSDoc(document);
        if (cancellationToken?.isCancellationRequested) {
            return null;
        }
        const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));

        const rawReferences = lang.findReferences(
            tsDoc.filePath,
            tsDoc.offsetAt(tsDoc.getGeneratedPosition(position))
        );
        if (!rawReferences) {
            return null;
        }

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver, lsContainer);
        snapshots.set(tsDoc.filePath, tsDoc);

        if (rawReferences.some((ref) => ref.definition.kind === ts.ScriptElementKind.alias)) {
            const componentReferences = await this.checkIfHasAliasedComponentReference(
                offset,
                tsDoc,
                lang
            );

            if (componentReferences?.length) {
                return componentReferences;
            }
        }
        const references = flatten(rawReferences.map((ref) => ref.references));

        references.push(
            ...(await this.getStoreReferences(
                references,
                tsDoc,
                snapshots,
                lang,
                cancellationToken
            ))
        );

        const locations = await Promise.all(
            references.map(async (ref) =>
                this.mapReference(ref, context, snapshots, cancellationToken)
            )
        );

        return (
            locations
                .filter(isNotNullOrUndefined)
                // Possible $store references are added afterwards, sort for correct order
                .sort(sortLocationByFileAndRange)
        );
    }

    private isScriptStartOrEndTag(position: Position, document: Document) {
        if (!document.scriptInfo) {
            return false;
        }
        const { start, end } = document.scriptInfo.container;

        const offset = document.offsetAt(position);
        return (
            (offset >= start && offset <= start + '<script'.length) ||
            (offset >= end - '</script>'.length && offset <= end)
        );
    }

    private isPositionForComponentCodeLens(position: Position) {
        return position.line === 0 && position.character === 0;
    }

    /**
     * If references of a $store are searched, also find references for the corresponding store
     * and vice versa.
     */
    private async getStoreReferences(
        references: ts.ReferencedSymbolEntry[],
        tsDoc: SvelteDocumentSnapshot,
        snapshots: SnapshotMap,
        lang: ts.LanguageService,
        cancellationToken: CancellationToken | undefined
    ): Promise<ts.ReferencedSymbolEntry[]> {
        // If user started finding references at $store, find references for store, too
        let storeReferences: ts.ReferencedSymbolEntry[] = [];
        const storeReference = references.find(
            (ref) =>
                normalizePath(ref.fileName) === tsDoc.filePath &&
                isTextSpanInGeneratedCode(tsDoc.getFullText(), ref.textSpan) &&
                is$storeVariableIn$storeDeclaration(tsDoc.getFullText(), ref.textSpan.start)
        );
        if (storeReference) {
            const additionalReferences =
                lang.findReferences(
                    tsDoc.filePath,
                    getStoreOffsetOf$storeDeclaration(
                        tsDoc.getFullText(),
                        storeReference.textSpan.start
                    )
                ) || [];
            storeReferences = flatten(additionalReferences.map((ref) => ref.references));
        }

        // If user started finding references at store, find references for $store, too
        // If user started finding references at $store, find references for $store in other files
        const $storeReferences: ts.ReferencedSymbolEntry[] = [];
        for (const ref of [...references, ...storeReferences]) {
            const snapshot = await snapshots.retrieve(ref.fileName);
            if (cancellationToken?.isCancellationRequested) {
                return [];
            }

            if (
                !(
                    isTextSpanInGeneratedCode(snapshot.getFullText(), ref.textSpan) &&
                    isStoreVariableIn$storeDeclaration(snapshot.getFullText(), ref.textSpan.start)
                )
            ) {
                continue;
            }
            if (storeReference?.fileName === ref.fileName) {
                // $store in X -> usages of store -> store in X -> we would add duplicate $store references
                continue;
            }

            const additionalReferences =
                lang.findReferences(
                    snapshot.filePath,
                    get$storeOffsetOf$storeDeclaration(snapshot.getFullText(), ref.textSpan.start)
                ) || [];
            $storeReferences.push(...flatten(additionalReferences.map((ref) => ref.references)));
        }

        return [...storeReferences, ...$storeReferences];
    }

    private async checkIfHasAliasedComponentReference(
        offset: number,
        tsDoc: SvelteDocumentSnapshot,
        lang: ts.LanguageService
    ) {
        const definitions = lang.getDefinitionAtPosition(tsDoc.filePath, offset);
        if (!definitions?.length) {
            return null;
        }

        const nonAliasDefinitions = definitions.filter((definition) =>
            isGeneratedSvelteComponentName(definition.name)
        );
        const references = await Promise.all(
            nonAliasDefinitions.map((definition) =>
                this.componentReferencesProvider.findComponentReferences(
                    pathToUrl(definition.fileName)
                )
            )
        );

        const flattened: Location[] = [];
        for (const ref of references) {
            if (ref) {
                const tmp: Location[] = []; // perf optimization: we know each iteration has unique references
                for (const r of ref) {
                    const exists = flattened.some(
                        (f) =>
                            f.uri === r.uri &&
                            f.range.start.line === r.range.start.line &&
                            f.range.start.character === r.range.start.character
                    );
                    if (!exists) {
                        tmp.push(r);
                    }
                }
                flattened.push(...tmp);
            }
        }

        return flattened;
    }

    private async mapReference(
        ref: ts.ReferencedSymbolEntry,
        context: ReferenceContext,
        snapshots: SnapshotMap,
        cancellationToken: CancellationToken | undefined
    ) {
        if (!context.includeDeclaration && ref.isDefinition) {
            return null;
        }

        const snapshot = await snapshots.retrieve(ref.fileName);

        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        if (isTextSpanInGeneratedCode(snapshot.getFullText(), ref.textSpan)) {
            return null;
        }

        // TODO we should deduplicate if we support finding references from multiple language service
        const location = convertToLocationForReferenceOrDefinition(snapshot, ref.textSpan);

        // Some references are in generated code but not wrapped with explicit ignore comments.
        // These show up as zero-length ranges, so filter them out.
        if (!hasNonZeroRange(location)) {
            return null;
        }

        return location;
    }

    private async getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}

function sortLocationByFileAndRange(l1: Location, l2: Location): number {
    const localeCompare = l1.uri.localeCompare(l2.uri);
    return localeCompare === 0
        ? (l1.range.start.line - l2.range.start.line) * 10000 +
              (l1.range.start.character - l2.range.start.character)
        : localeCompare;
}
