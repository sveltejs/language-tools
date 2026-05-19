import { Stats } from 'fs';
import fs from 'fs/promises';
import {
    FileStat,
    FileSystemProvider as CSSFileSystemProvider,
    FileType
} from 'vscode-css-languageservice';
import { FileService } from '@vscode/emmet-helper';
import { urlToPath } from '../utils';
import { URI } from 'vscode-uri';

interface StatLike {
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
}

export class FileSystemProvider implements CSSFileSystemProvider, FileService {
    constructor() {
        this.readDirectory = this.readDirectory.bind(this);
        this.stat = this.stat.bind(this);
    }
    async stat(uri: URI): Promise<FileStat>;
    async stat(uri: string): Promise<FileStat>;
    async stat(uri: string | URI): Promise<FileStat> {
        const path = typeof uri === 'string' ? urlToPath(uri) : uri.fsPath;

        if (!path) {
            return this.unknownStat();
        }

        let stat: Stats;
        try {
            stat = await fs.stat(path);
        } catch (error) {
            if (
                error != null &&
                typeof error === 'object' &&
                'code' in error &&
                (error as { code: string }).code === 'ENOENT'
            ) {
                return {
                    type: FileType.Unknown,
                    ctime: -1,
                    mtime: -1,
                    size: -1
                };
            }

            throw error;
        }

        return {
            ctime: stat.ctimeMs,
            mtime: stat.mtimeMs,
            size: stat.size,
            type: this.getFileType(stat)
        };
    }

    private unknownStat(): FileStat {
        return {
            type: FileType.Unknown,
            ctime: -1,
            mtime: -1,
            size: -1
        };
    }

    private getFileType(stat: StatLike) {
        return stat.isDirectory()
            ? FileType.Directory
            : stat.isFile()
              ? FileType.File
              : stat.isSymbolicLink()
                ? FileType.SymbolicLink
                : FileType.Unknown;
    }

    async readDirectory(uri: string): Promise<Array<[string, FileType]>> {
        const path = urlToPath(uri);

        if (!path) {
            return [];
        }

        const files = await fs.readdir(path, {
            withFileTypes: true
        });

        return files.map((file) => [file.name, this.getFileType(file)]);
    }

    async readFile(uri: URI): Promise<Uint8Array> {
        const path = uri.fsPath;
        const data = await fs.readFile(path);
        return new Uint8Array(data);
    }
}
