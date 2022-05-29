import ts from 'typescript';
import { Location, Position, ReferenceContext } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { flatten, pathToUrl } from '../../../utils';
import { FindReferencesProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange, hasNonZeroRange } from '../utils';
import { isInGeneratedCode, isNoTextSpanInGeneratedCode, SnapshotFragmentMap } from './utils';

export class FindReferencesProviderImpl implements FindReferencesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async findReferences(
        document: Document,
        position: Position,
        context: ReferenceContext
    ): Promise<Location[] | null> {
        const { lang, tsDoc } = await this.getLSAndTSDoc(document);
        const fragment = tsDoc.getFragment();

        const rawReferences = lang.findReferences(
            tsDoc.filePath,
            fragment.offsetAt(fragment.getGeneratedPosition(position))
        );
        if (!rawReferences) {
            return null;
        }
        const references = flatten(rawReferences.map((ref) => ref.references));

        const storeReference = references.find(
            (ref) =>
                isInGeneratedCode(
                    tsDoc.getFullText(),
                    ref.textSpan.start,
                    ref.textSpan.start + ref.textSpan.length
                ) &&
                // handle both cases of references triggered at store and triggered at $store
                (tsDoc.getFullText().substring(ref.textSpan.start).startsWith('$') ||
                    tsDoc
                        .getFullText()
                        .lastIndexOf('__sveltets_1_store_get(', ref.textSpan.start) ===
                        ref.textSpan.start - '__sveltets_1_store_get('.length)
        );
        if (storeReference) {
            const storeReferences =
                lang.findReferences(
                    tsDoc.filePath,
                    // handle both cases of references triggered at store and triggered at $store
                    tsDoc.getFullText().charAt(storeReference.textSpan.start) === '$'
                        ? tsDoc.getFullText().indexOf(');', storeReference.textSpan.start) - 1
                        : tsDoc.getFullText().lastIndexOf(' =', storeReference.textSpan.start) - 1
                ) || [];
            references.push(...flatten(storeReferences.map((ref) => ref.references)));
            // TODO all $store usages in other Svelte files, too?
        }

        const docs = new SnapshotFragmentMap(this.lsAndTsDocResolver);
        docs.set(tsDoc.filePath, { fragment, snapshot: tsDoc });

        const locations = await Promise.all(
            references
                .filter((ref) => context.includeDeclaration || !ref.isDefinition)
                .filter(notInGeneratedCode(tsDoc.getFullText()))
                .map(async (ref) => {
                    const defDoc = await docs.retrieveFragment(ref.fileName);

                    return Location.create(
                        pathToUrl(ref.fileName),
                        convertToLocationRange(defDoc, ref.textSpan)
                    );
                })
        );
        // Some references are in generated code but not wrapped with explicit ignore comments.
        // These show up as zero-length ranges, so filter them out.
        return locations.filter(hasNonZeroRange);
    }

    private async getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}

function notInGeneratedCode(text: string) {
    return (ref: ts.ReferenceEntry) => {
        return isNoTextSpanInGeneratedCode(text, ref.textSpan);
    };
}
