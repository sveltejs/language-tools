import { Position, Location } from 'vscode-languageserver-protocol';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { pathToUrl, isNotNullOrUndefined } from '../../../utils';
import { TypeDefinitionProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';
import { isTextSpanInGeneratedCode, SnapshotMap } from './utils';

export class TypeDefinitionProviderImpl implements TypeDefinitionProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getTypeDefinition(document: Document, position: Position): Promise<Location[] | null> {
        const { tsDoc, lang } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);
        const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));
        const typeDefs = lang.getTypeDefinitionAtPosition(tsDoc.filePath, offset);

        const snapshots = new SnapshotMap(this.lsAndTsDocResolver);
        snapshots.set(tsDoc.filePath, tsDoc);

        if (!typeDefs) {
            return null;
        }

        const result = await Promise.all(
            typeDefs.map(async (typeDef) => {
                const snapshot = await snapshots.retrieve(typeDef.fileName);

                if (isTextSpanInGeneratedCode(snapshot.getFullText(), typeDef.textSpan)) {
                    return;
                }

                const range = mapRangeToOriginal(
                    snapshot,
                    convertRange(snapshot, typeDef.textSpan)
                );

                if (range.start.line >= 0 && range.end.line >= 0) {
                    return Location.create(pathToUrl(typeDef.fileName), range);
                }
            })
        );

        return result.filter(isNotNullOrUndefined);
    }
}
