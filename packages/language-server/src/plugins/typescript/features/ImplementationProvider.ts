import { Position, Location } from 'vscode-languageserver-protocol';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { pathToUrl, isNotNullOrUndefined } from '../../../utils';
import { ImplementationProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';
import { isNoTextSpanInGeneratedCode, SnapshotMap } from './utils';

export class ImplementationProviderImpl implements ImplementationProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getImplementation(document: Document, position: Position): Promise<Location[] | null> {
        const { tsDoc, lang } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);
        const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));
        const implementations = lang.getImplementationAtPosition(tsDoc.filePath, offset);

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver);
        snapshots.set(tsDoc.filePath, tsDoc);

        if (!implementations) {
            return null;
        }

        const result = await Promise.all(
            implementations.map(async (implementation) => {
                const snapshot = await snapshots.retrieve(implementation.fileName);

                if (!isNoTextSpanInGeneratedCode(snapshot.getFullText(), implementation.textSpan)) {
                    return;
                }

                const range = mapRangeToOriginal(
                    snapshot,
                    convertRange(snapshot, implementation.textSpan)
                );

                if (range.start.line >= 0 && range.end.line >= 0) {
                    return Location.create(pathToUrl(implementation.fileName), range);
                }
            })
        );

        return result.filter(isNotNullOrUndefined);
    }
}
