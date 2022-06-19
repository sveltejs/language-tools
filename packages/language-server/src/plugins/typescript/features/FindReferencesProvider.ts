import type ts from 'typescript';
import { Location, Position, ReferenceContext } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { flatten, isNotNullOrUndefined, pathToUrl } from '../../../utils';
import { FindReferencesProvider } from '../../interfaces';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange, hasNonZeroRange } from '../utils';
import {
    get$storeOffsetOf$storeDeclaration,
    getStoreOffsetOf$storeDeclaration,
    is$storeVariable,
    isStoreVariableIn$storeDeclaration,
    isTextSpanInGeneratedCode,
    SnapshotMap
} from './utils';

export class FindReferencesProviderImpl implements FindReferencesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async findReferences(
        document: Document,
        position: Position,
        context: ReferenceContext
    ): Promise<Location[] | null> {
        const { lang, tsDoc } = await this.getLSAndTSDoc(document);

        const rawReferences = lang.findReferences(
            tsDoc.filePath,
            tsDoc.offsetAt(tsDoc.getGeneratedPosition(position))
        );
        if (!rawReferences) {
            return null;
        }

        const references = flatten(rawReferences.map((ref) => ref.references));
        references.push(...this.enhanceStoreReferences(references, tsDoc, lang));

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver);
        snapshots.set(tsDoc.filePath, tsDoc);
        const locations = await Promise.all(
            references.map(async (ref) => this.mapReference(ref, context, snapshots))
        );

        return (
            locations
                .filter(isNotNullOrUndefined)
                // Possible $store references are added afterwards, sort for correct order
                .sort(sortLocationByRange)
        );
    }

    /**
     * If references of a $store are searched, also find references for the corresponding store
     * and vice versa.
     */
    private enhanceStoreReferences(
        references: ts.ReferencedSymbolEntry[],
        tsDoc: SvelteDocumentSnapshot,
        lang: ts.LanguageService
    ): ts.ReferencedSymbolEntry[] {
        const storeReference = references.find(
            (ref) =>
                isTextSpanInGeneratedCode(tsDoc.getFullText(), ref.textSpan) &&
                // handle both cases of references triggered at store and triggered at $store
                (is$storeVariable(tsDoc.getFullText(), ref.textSpan.start) ||
                    isStoreVariableIn$storeDeclaration(tsDoc.getFullText(), ref.textSpan.start))
        );
        if (!storeReference) {
            return [];
        }

        const storeReferences =
            lang.findReferences(
                tsDoc.filePath,
                // handle both cases of references triggered at store and triggered at $store
                is$storeVariable(tsDoc.getFullText(), storeReference.textSpan.start)
                    ? getStoreOffsetOf$storeDeclaration(
                          tsDoc.getFullText(),
                          storeReference.textSpan.start
                      )
                    : get$storeOffsetOf$storeDeclaration(
                          tsDoc.getFullText(),
                          storeReference.textSpan.start
                      )
            ) || [];
        return flatten(storeReferences.map((ref) => ref.references));
        // TODO all $store usages in other Svelte files, too?
    }

    private async mapReference(
        ref: ts.ReferencedSymbolEntry,
        context: ReferenceContext,
        snapshots: SnapshotMap
    ) {
        if (!context.includeDeclaration && ref.isDefinition) {
            return null;
        }

        const snapshot = await snapshots.retrieve(ref.fileName);

        if (isTextSpanInGeneratedCode(snapshot.getFullText(), ref.textSpan)) {
            return null;
        }

        const location = Location.create(
            pathToUrl(ref.fileName),
            convertToLocationRange(snapshot, ref.textSpan)
        );

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

function sortLocationByRange(l1: Location, l2: Location): number {
    return (
        (l1.range.start.line - l2.range.start.line) * 10000 +
        (l1.range.start.character - l2.range.start.character)
    );
}
