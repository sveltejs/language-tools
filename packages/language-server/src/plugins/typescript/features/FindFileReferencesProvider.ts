import { Location } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { FileReferencesProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange, hasNonZeroRange } from '../utils';
import { SnapshotMap } from './utils';
import { pathToUrl } from '../../../utils';

export class FindFileReferencesProviderImpl implements FileReferencesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async fileReferences(uri: string): Promise<Location[] | null> {
        const u = URI.parse(uri);
        const fileName = u.fsPath;

        const lsContainer = await this.lsAndTsDocResolver.getTSService(fileName);
        const lang = lsContainer.getService();
        const tsDoc = await this.getSnapshotForPath(fileName);

        const references = lang.getFileReferences(fileName);

        if (!references) {
            return null;
        }

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver, lsContainer);
        snapshots.set(tsDoc.filePath, tsDoc);

        const locations = await Promise.all(
            references.map(async (ref) => {
                const snapshot = await snapshots.retrieve(ref.fileName);

                return Location.create(
                    pathToUrl(ref.fileName),
                    convertToLocationRange(snapshot, ref.textSpan)
                );
            })
        );
        // Some references are in generated code but not wrapped with explicit ignore comments.
        // These show up as zero-length ranges, so filter them out.
        return locations.filter(hasNonZeroRange);
    }

    private async getSnapshotForPath(path: string) {
        return this.lsAndTsDocResolver.getOrCreateSnapshot(path);
    }
}
