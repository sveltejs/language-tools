import { Location } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { FileReferencesProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';

export class FindFileReferencesProviderImpl implements FileReferencesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async fileReferences(fileName: string): Promise<Location[] | null> {
        //??
    }
}
