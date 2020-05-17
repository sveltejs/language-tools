import { DocumentSnapshot } from './DocumentSnapshot';

export class SnapshotManager {
    private static managerContainer: Map<string, SnapshotManager> = new Map();

    static getFromTsConfigPath(tsconfigPath: string): SnapshotManager {
        let manager = this.managerContainer.get(tsconfigPath);

        if (!manager) {
            manager = new SnapshotManager();
            this.managerContainer.set(tsconfigPath, manager);
        }

        return manager;
    }

    private documents: Map<string, DocumentSnapshot> = new Map();

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
        return this.documents.delete(fileName);
    }

    getFileNames() {
        return Array.from(this.documents.keys());
    }
}
