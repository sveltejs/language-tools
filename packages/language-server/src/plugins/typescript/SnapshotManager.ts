import { DocumentSnapshot, SvelteSnapshotOptions } from './DocumentSnapshot';

export class SnapshotManager {
    constructor(
        private projectFiles: string[]
    ) { }

    private documents: Map<string, DocumentSnapshot> = new Map();

    updateByFileName(fileName: string, options: SvelteSnapshotOptions) {
        if (!this.projectFiles.includes(fileName)) {
            return;
        }

        const newSnapshot = DocumentSnapshot.fromFilePath(fileName, options);
        const previousSnapshot = this.get(fileName);

        if (previousSnapshot) {
            newSnapshot.version = previousSnapshot.version + 1;
        } else {
            // ensure it's greater than initial version
            // so that ts server picks up the change
            newSnapshot.version += 1;
        }

        this.set(fileName, newSnapshot);
    }

    set(fileName: string, snapshot: DocumentSnapshot) {
        const prev = this.get(fileName);
        if (prev) {
            prev.destroyFragment();
        }

        return this.documents.set(fileName, snapshot);
    }

    get(fileName: string) {
        return this.documents.get(fileName);
    }

    delete(fileName: string) {
        this.projectFiles = this.projectFiles
            .filter(s => s !== fileName);
        return this.documents.delete(fileName);
    }

    getFileNames() {
        return Array.from(this.documents.keys());
    }

    getProjectFileNames() {
        return [...this.projectFiles];
    }
}
