import path from 'path';
import {
    OptionalVersionedTextDocumentIdentifier,
    TextDocumentEdit,
    TextEdit,
    WorkspaceEdit
} from 'vscode-languageserver';
import { mapRangeToOriginal } from '../../../lib/documents';
import {
    createGetCanonicalFileName,
    GetCanonicalFileName,
    normalizePath,
    urlToPath
} from '../../../utils';
import { FileRename, UpdateImportsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { forAllServices, LanguageServiceContainer } from '../service';
import { convertRange } from '../utils';
import { isKitTypePath, SnapshotMap } from './utils';

export class UpdateImportsProviderImpl implements UpdateImportsProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        useCaseSensitiveFileNames: boolean
    ) {
        this.getCanonicalFileName = createGetCanonicalFileName(useCaseSensitiveFileNames);
    }

    private getCanonicalFileName: GetCanonicalFileName;

    async updateImports(fileRename: FileRename): Promise<WorkspaceEdit | null> {
        // TODO does this handle folder moves/renames correctly? old/new path isn't a file then
        const oldPath = urlToPath(fileRename.oldUri);
        const newPath = urlToPath(fileRename.newUri);
        if (!oldPath || !newPath) {
            return null;
        }

        const services: LanguageServiceContainer[] = [];
        await forAllServices((ls) => {
            services.push(ls);
        });

        const documentChanges = new Map<string, TextDocumentEdit>();
        for (const service of services) {
            await this.updateImportForSingleService(oldPath, newPath, service, documentChanges);
        }

        return {
            documentChanges: Array.from(documentChanges.values())
        };
    }

    async updateImportForSingleService(
        oldPath: string,
        newPath: string,
        lsContainer: LanguageServiceContainer,
        documentChanges: Map<string, TextDocumentEdit>
    ) {
        const ls = lsContainer.getService();
        const program = ls.getProgram();
        if (!program) {
            return;
        }

        const canonicalOldPath = this.getCanonicalFileName(normalizePath(oldPath));
        const canonicalNewPath = this.getCanonicalFileName(normalizePath(newPath));
        const hasFile = program.getSourceFiles().some((sf) => {
            const normalizedFileName = this.getCanonicalFileName(normalizePath(sf.fileName));
            return (
                normalizedFileName.startsWith(canonicalOldPath) ||
                normalizedFileName.startsWith(canonicalNewPath)
            );
        });

        if (!hasFile) {
            return;
        }

        const oldPathTsProgramCasing = ls.getProgram()?.getSourceFile(oldPath)?.fileName ?? oldPath;
        // `getEditsForFileRename` might take a while
        const fileChanges = ls
            .getEditsForFileRename(oldPathTsProgramCasing, newPath, {}, {})
            // Assumption: Updating imports will not create new files, and to make sure just filter those out
            // who - for whatever reason - might be new ones.
            .filter((change) => !change.isNewFile || change.fileName === oldPathTsProgramCasing);

        await this.lsAndTsDocResolver.updateSnapshotPath(oldPathTsProgramCasing, newPath);

        const editInOldPath = fileChanges.find(
            (change) =>
                change.fileName.startsWith(oldPathTsProgramCasing) &&
                (oldPathTsProgramCasing.includes(newPath) || !change.fileName.startsWith(newPath))
        );
        const editInNewPath = fileChanges.find(
            (change) =>
                change.fileName.startsWith(newPath) &&
                (newPath.includes(oldPathTsProgramCasing) ||
                    !change.fileName.startsWith(oldPathTsProgramCasing))
        );
        const updateImportsChanges = fileChanges
            .filter((change) => {
                if (isKitTypePath(change.fileName)) {
                    // These types are generated from the route files, so we don't want to update them
                    return false;
                }
                if (!editInOldPath || !editInNewPath) {
                    return true;
                }
                // If both present, take the one that has more text changes to it (more likely to be the correct one)
                return editInOldPath.textChanges.length > editInNewPath.textChanges.length
                    ? change !== editInNewPath
                    : change !== editInOldPath;
            })
            .map((change) => {
                if (change === editInOldPath) {
                    // The language service might want to do edits to the old path, not the new path -> rewire it.
                    // If there is a better solution for this, please file a PR :)
                    change.fileName = change.fileName.replace(oldPathTsProgramCasing, newPath);
                }
                change.textChanges = change.textChanges.filter(
                    (textChange) =>
                        // Filter out changes to './$type' imports for Kit route files,
                        // you'll likely want these to stay as-is
                        !isKitTypePath(textChange.newText) ||
                        !path.basename(change.fileName).startsWith('+')
                );
                return change;
            });

        const docs = new SnapshotMap(this.lsAndTsDocResolver, lsContainer);
        await Promise.all(
            updateImportsChanges.map(async (change) => {
                if (documentChanges.has(change.fileName)) {
                    return;
                }
                const snapshot = await docs.retrieve(change.fileName);

                const edit = TextDocumentEdit.create(
                    OptionalVersionedTextDocumentIdentifier.create(snapshot.getURL(), null),
                    change.textChanges.map((edit) => {
                        const range = mapRangeToOriginal(
                            snapshot,
                            convertRange(snapshot, edit.span)
                        );
                        return TextEdit.replace(range, edit.newText);
                    })
                );

                documentChanges.set(change.fileName, edit);
            })
        );
    }
}
