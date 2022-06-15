import { Location, Position, ReferenceContext } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { flatten, isNotNullOrUndefined, pathToUrl } from '../../../utils';
import { FindReferencesProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange, hasNonZeroRange } from '../utils';
import { isNoTextSpanInGeneratedCode, SnapshotMap } from './utils';

export class FindReferencesProviderImpl implements FindReferencesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async findReferences(
        document: Document,
        position: Position,
        context: ReferenceContext
    ): Promise<Location[] | null> {
        const { lang, tsDoc } = await this.getLSAndTSDoc(document);

        const references = lang.findReferences(
            tsDoc.filePath,
            tsDoc.offsetAt(tsDoc.getGeneratedPosition(position))
        );
        if (!references) {
            return null;
        }

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver);
        snapshots.set(tsDoc.filePath, tsDoc);

        const locations = await Promise.all(
            flatten(references.map((ref) => ref.references)).map(async (ref) => {
                if (!context.includeDeclaration && ref.isDefinition) {
                    return null;
                }

                const snapshot = await snapshots.retrieve(ref.fileName);

                if (!isNoTextSpanInGeneratedCode(snapshot.getFullText(), ref.textSpan)) {
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
            })
        );

        return locations.filter(isNotNullOrUndefined);
    }

    private async getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}
