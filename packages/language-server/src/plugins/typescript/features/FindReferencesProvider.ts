import { Location, Position, ReferenceContext } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { pathToUrl } from '../../../utils';
import { FindReferencesProvider } from '../../interfaces';
import { SnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange } from '../utils';

export class FindReferencesProviderImpl implements FindReferencesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async findReferences(
        document: Document,
        position: Position,
        context: ReferenceContext
    ): Promise<Location[] | null> {
        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const references = lang.getReferencesAtPosition(
            tsDoc.filePath,
            fragment.offsetAt(fragment.getGeneratedPosition(position))
        );
        if (!references) {
            return null;
        }

        const docs = new Map<string, SnapshotFragment>([[tsDoc.filePath, fragment]]);

        return await Promise.all(
            references
                .filter((ref) => context.includeDeclaration || !ref.isDefinition)
                .map(async (ref) => {
                    let defDoc = docs.get(ref.fileName);
                    if (!defDoc) {
                        defDoc = await this.getSnapshot(ref.fileName).getFragment();
                        docs.set(ref.fileName, defDoc);
                    }

                    return Location.create(
                        pathToUrl(ref.fileName),
                        convertToLocationRange(defDoc, ref.textSpan)
                    );
                })
        );
    }

    private getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }

    private getSnapshot(filePath: string, document?: Document) {
        return this.lsAndTsDocResolver.getSnapshot(filePath, document);
    }
}
