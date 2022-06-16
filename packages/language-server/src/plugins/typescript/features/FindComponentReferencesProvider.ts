import { Location, Position, Range } from 'vscode-languageserver';
import { flatten, isNotNullOrUndefined, pathToUrl, urlToPath } from '../../../utils';
import { FindComponentReferencesProvider } from '../../interfaces';
import {
    DocumentSnapshot,
    SvelteDocumentSnapshot,
    SvelteSnapshotFragment
} from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange, hasNonZeroRange } from '../utils';
import { isNoTextSpanInGeneratedCode, SnapshotFragmentMap } from './utils';

const COMPONENT_SUFFIX = '__SvelteComponent_';

export class FindComponentReferencesProviderImpl implements FindComponentReferencesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async findComponentReferences(uri: string): Promise<Location[] | null> {
        // No document available, just the uri, because it could be called on an unopened file
        const fileName = urlToPath(uri);
        if (!fileName) {
            return null;
        }

        const lang = await this.lsAndTsDocResolver.getLSForPath(fileName);
        const tsDoc = await this.lsAndTsDocResolver.getSnapshot(fileName);
        const fragment = tsDoc.getFragment();
        if (!(fragment instanceof SvelteSnapshotFragment)) {
            return null;
        }

        const references = lang.findReferences(
            tsDoc.filePath,
            this.offsetOfComponentExport(fragment)
        );
        if (!references) {
            return null;
        }

        const docs = new SnapshotFragmentMap(this.lsAndTsDocResolver);
        docs.set(tsDoc.filePath, { fragment, snapshot: tsDoc });

        const locations = await Promise.all(
            flatten(references.map((ref) => ref.references)).map(async (ref) => {
                if (ref.isDefinition) {
                    return null;
                }

                const { fragment, snapshot } = await docs.retrieve(ref.fileName);

                if (!isNoTextSpanInGeneratedCode(snapshot.getFullText(), ref.textSpan)) {
                    return null;
                }

                const refLocation = Location.create(
                    pathToUrl(ref.fileName),
                    convertToLocationRange(fragment, ref.textSpan)
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

    private offsetOfComponentExport(fragment: SvelteSnapshotFragment) {
        return fragment.text.lastIndexOf(COMPONENT_SUFFIX);
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
