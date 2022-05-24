import { Location } from 'vscode-languageserver';
import { FileReferencesProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';

export class FindFileReferencesProviderImpl implements FileReferencesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async fileReferences(fileName: string): Promise<Location[] | null> {
        const lang = await this.getLSForPath(fileName);

        const references = lang.getFileReferences(fileName);

        if (!references) {
            return null;
        }

        return [];

        // const docs = new SnapshotFragmentMap(this.lsAndTsDocResolver);
        // docs.set(tsDoc.filePath, { fragment, snapshot: tsDoc });

        // const locations = await Promise.all(
        //     references.map(async (ref) => {
        //         const defDoc = await docs.retrieveFragment(ref.fileName);

        //         return Location.create(
        //             pathToUrl(ref.fileName),
        //             convertToLocationRange(defDoc, ref.textSpan)
        //         );
        //     })
        // );
        // // Some references are in generated code but not wrapped with explicit ignore comments.
        // // These show up as zero-length ranges, so filter them out.
        // return locations.filter(hasNonZeroRange);
    }

    private async getLSForPath(path: string) {
        return this.lsAndTsDocResolver.getLSForPath(path);
    }
}
