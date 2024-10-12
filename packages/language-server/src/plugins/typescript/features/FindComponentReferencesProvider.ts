import { Location, Position, Range } from 'vscode-languageserver';
import { flatten, isNotNullOrUndefined, pathToUrl, urlToPath } from '../../../utils';
import { FindComponentReferencesProvider } from '../../interfaces';
import { DocumentSnapshot, SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import {
    convertToLocationRange,
    hasNonZeroRange,
    offsetOfGeneratedComponentExport
} from '../utils';
import { isTextSpanInGeneratedCode, SnapshotMap } from './utils';

export class FindComponentReferencesProviderImpl implements FindComponentReferencesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async findComponentReferences(uri: string): Promise<Location[] | null> {
        // No document available, just the uri, because it could be called on an unopened file
        const fileName = urlToPath(uri);
        if (!fileName) {
            return null;
        }

        const lsContainer = await this.lsAndTsDocResolver.getTSService(fileName);
        const lang = lsContainer.getService();
        const tsDoc = await this.lsAndTsDocResolver.getOrCreateSnapshot(fileName);
        if (!(tsDoc instanceof SvelteDocumentSnapshot)) {
            return null;
        }

        const references = lang.findReferences(
            tsDoc.filePath,
            offsetOfGeneratedComponentExport(tsDoc)
        );
        if (!references) {
            return null;
        }

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver, lsContainer);
        snapshots.set(tsDoc.filePath, tsDoc);

        const locations = await Promise.all(
            flatten(references.map((ref) => ref.references)).map(async (ref) => {
                if (ref.isDefinition) {
                    return null;
                }

                const snapshot = await snapshots.retrieve(ref.fileName);

                if (isTextSpanInGeneratedCode(snapshot.getFullText(), ref.textSpan)) {
                    return null;
                }

                const refLocation = Location.create(
                    pathToUrl(ref.fileName),
                    convertToLocationRange(snapshot, ref.textSpan)
                );

                //Only report starting tags
                if (this.isEndTag(refLocation, snapshot)) {
                    return null;
                }

                // Some references are in generated code but not wrapped with explicit ignore comments.
                // These show up as zero-length ranges, so filter them out.
                if (!hasNonZeroRange(refLocation)) {
                    return null;
                }

                return refLocation;
            })
        );

        return locations.filter(isNotNullOrUndefined);
    }

    private isEndTag(element: Location, snapshot: DocumentSnapshot) {
        if (!(snapshot instanceof SvelteDocumentSnapshot)) {
            return false;
        }

        const testEndTagRange = Range.create(
            Position.create(element.range.start.line, element.range.start.character - 1),
            element.range.end
        );

        const text = snapshot.getOriginalText(testEndTagRange);
        if (text.substring(0, 1) == '/') {
            return true;
        }

        return false;
    }
}
