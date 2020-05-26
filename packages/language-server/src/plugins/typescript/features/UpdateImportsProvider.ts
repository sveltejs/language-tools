import {
    TextDocumentEdit,
    TextEdit,
    VersionedTextDocumentIdentifier,
    WorkspaceEdit,
} from 'vscode-languageserver';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { urlToPath } from '../../../utils';
import { FileRename, UpdateImportsProvider } from '../../interfaces';
import { SnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange } from '../utils';

export class UpdateImportsProviderImpl implements UpdateImportsProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async updateImports(fileRename: FileRename): Promise<WorkspaceEdit | null> {
        const oldPath = urlToPath(fileRename.oldUri);
        const newPath = urlToPath(fileRename.newUri);
        if (!oldPath || !newPath) {
            return null;
        }

        const ls = this.getLSForPath(newPath);
        // `getEditsForFileRename` might take a while
        const fileChanges = ls.getEditsForFileRename(oldPath, newPath, {}, {});

        const docs = new Map<string, SnapshotFragment>();
        // Assumption: Updating imports will not create new files, and to make sure just filter those out
        // who - for whatever reason - might be new ones.
        const updateImportsChanges = fileChanges.filter((change) => !change.isNewFile);

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
                        let range = mapRangeToOriginal(
                            fragment!,
                            convertRange(fragment!, edit.span),
                        );
                        // Handle svelte2tsx wrong import mapping:
                        // The character after the last import maps to the start of the script
                        // TODO find a way to fix this in svelte2tsx and then remove this
                        if (range.end.line === 0 && range.end.character === 1) {
                            edit.span.length -= 1;
                            range = mapRangeToOriginal(
                                fragment!,
                                convertRange(fragment!, edit.span),
                            );
                            range.end.character += 1;
                        }
                        return TextEdit.replace(range, edit.newText);
                    }),
                );
            }),
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
