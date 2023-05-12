import { Position, Location } from 'vscode-languageserver-protocol';
import { Document, mapLocationToOriginal } from '../../../lib/documents';
import { isNotNullOrUndefined } from '../../../utils';
import { ImplementationProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';
import {
    is$storeVariableIn$storeDeclaration,
    isTextSpanInGeneratedCode,
    SnapshotMap
} from './utils';

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
                let snapshot = await snapshots.retrieve(implementation.fileName);

                // Go from generated $store to store if user wants to find implementation for $store
                if (isTextSpanInGeneratedCode(snapshot.getFullText(), implementation.textSpan)) {
                    if (
                        !is$storeVariableIn$storeDeclaration(
                            snapshot.getFullText(),
                            implementation.textSpan.start
                        )
                    ) {
                        return;
                    }
                    // there will be exactly one definition, the store
                    implementation = lang.getImplementationAtPosition(
                        tsDoc.filePath,
                        tsDoc.getFullText().indexOf(');', implementation.textSpan.start) - 1
                    )![0];
                    snapshot = await snapshots.retrieve(implementation.fileName);
                }

                const location = mapLocationToOriginal(
                    snapshot,
                    convertRange(snapshot, implementation.textSpan)
                );

                if (location.range.start.line >= 0 && location.range.end.line >= 0) {
                    return location;
                }
            })
        );

        return result.filter(isNotNullOrUndefined);
    }
}
