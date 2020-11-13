import ts from 'typescript';
import {
    TextDocumentEdit,
    TextEdit,
    VersionedTextDocumentIdentifier,
    WorkspaceEdit
} from 'vscode-languageserver';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { urlToPath } from '../../../utils';
import { FileRename, UpdateImportsProvider } from '../../interfaces';
import { SnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';

export class UpdateImportsProviderImpl implements UpdateImportsProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly getUserPreferences: () => ts.UserPreferences
    ) { }

    async updateImports(fileRename: FileRename): Promise<WorkspaceEdit | null> {
        const oldPath = urlToPath(fileRename.oldUri);
        const newPath = urlToPath(fileRename.newUri);
        if (!oldPath || !newPath) {
            return null;
        }

        const ls = this.getLSForPath(newPath);
        // `getEditsForFileRename` might take a while
        const fileChanges = ls.getEditsForFileRename(
            oldPath,
            newPath,
            {},
            this.getUserPreferences()
        );

        this.lsAndTsDocResolver.updateSnapshotPath(oldPath, newPath);
        const updateImportsChanges = fileChanges
            // Assumption: Updating imports will not create new files, and to make sure just filter those out
            // who - for whatever reason - might be new ones.
            .filter((change) => !change.isNewFile || change.fileName === oldPath)
            // The language service might want to do edits to the old path, not the new path -> rewire it.
            // If there is a better solution for this, please file a PR :)
            .map((change) => {
                change.fileName = change.fileName.replace(oldPath, newPath);
                return change;
            });

        const docs = new Map<string, SnapshotFragment>();
        const documentChanges = await Promise.all(
            updateImportsChanges.map(async (change) => {
                let fragment = docs.get(change.fileName);
                if (!fragment) {
                    fragment = await this.getSnapshot(change.fileName).getFragment();
                    docs.set(change.fileName, fragment);
                }

                return TextDocumentEdit.create(
                    VersionedTextDocumentIdentifier.create(fragment.getURL(), null),
                    change.textChanges.map((edit) => {
                        const range = mapRangeToOriginal(
                            fragment!,
                            convertRange(fragment!, edit.span)
                        );
                        return TextEdit.replace(range, edit.newText);
                    })
                );
            })
        );

        return { documentChanges };
    }

    private getLSForPath(path: string) {
        return this.lsAndTsDocResolver.getLSForPath(path);
    }

    private getSnapshot(filePath: string, document?: Document) {
        return this.lsAndTsDocResolver.getSnapshot(filePath, document);
    }
}
