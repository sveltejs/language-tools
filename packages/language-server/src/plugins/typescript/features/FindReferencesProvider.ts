import ts from 'typescript';
import { Location, Position, ReferenceContext } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { flatten, pathToUrl } from '../../../utils';
import { FindReferencesProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange, hasNonZeroRange } from '../utils';
import {
    get$storeDeclarationStart,
    getStoreGetShimVarStart,
    is$storeDeclarationVar,
    isInsideStoreGetShim,
    isNoTextSpanInGeneratedCode,
    SnapshotFragmentMap
} from './utils';

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
                !isNoTextSpanInGeneratedCode(tsDoc.getFullText(), ref.textSpan) &&
                // handle both cases of references triggered at store and triggered at $store
                (is$storeDeclarationVar(tsDoc.getFullText(), ref.textSpan.start) ||
                    isInsideStoreGetShim(tsDoc.getFullText(), ref.textSpan.start))
        );
        if (storeReference) {
            const storeReferences =
                lang.findReferences(
                    tsDoc.filePath,
                    // handle both cases of references triggered at store and triggered at $store
                    is$storeDeclarationVar(tsDoc.getFullText(), storeReference.textSpan.start)
                        ? getStoreGetShimVarStart(
                              tsDoc.getFullText(),
                              storeReference.textSpan.start
                          )
                        : get$storeDeclarationStart(
                              tsDoc.getFullText(),
                              storeReference.textSpan.start
                          )
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
