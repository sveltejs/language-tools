import ts from 'typescript';
import { createGetCanonicalFileName, GetCanonicalFileName } from '../../utils';

/**
 * wrapper around Map<string, T> for
 * case case insensitive file system
 */
export class FileMap<T> {
    private getCanonicalFileName: GetCanonicalFileName;
    private readonly map = new Map<string, T>();
    private readonly originalNames = new Map<string, string[]>();

    constructor(useCaseSensitiveFileNames = ts.sys.useCaseSensitiveFileNames) {
        this.getCanonicalFileName = createGetCanonicalFileName(useCaseSensitiveFileNames);
    }

    get(filePath: string) {
        return this.map.get(this.getCanonicalFileName(filePath));
    }

    set(filePath: string, value: T) {
        const canonicalFileName = this.getCanonicalFileName(filePath);
        this.originalNames.set(
            canonicalFileName,
            (this.originalNames.get(canonicalFileName) ?? []).concat(filePath)
        );
        return this.map.set(canonicalFileName, value);
    }

    has(filePath: string) {
        return this.map.has(this.getCanonicalFileName(filePath));
    }

    delete(filePath: string) {
        return this.map.delete(this.getCanonicalFileName(filePath));
    }

    /**
     * return name value pair for the original names added with {@link FileMap.set}
     */
    *entries(): IterableIterator<[string, T]> {
        for (const [filePath, value] of this.map.entries()) {
            const originalNames = this.originalNames.get(filePath);

            if (!originalNames) {
                continue;
            }

            for (const originalName of originalNames) {
                yield [originalName, value];
            }
        }
    }

    forEach(callbackfn: (value: T, key: string) => void) {
        Array.from(this.entries()).forEach(([filePath, value]) => callbackfn(value, filePath));
    }

    *keys(): IterableIterator<string> {
        for (const [filePath] of this.entries()) {
            yield filePath;
        }
    }
}

export class FileSet {
    private getCanonicalFileName: GetCanonicalFileName;
    private readonly set = new Set<string>();

    constructor(useCaseSensitiveFileNames = ts.sys.useCaseSensitiveFileNames) {
        this.getCanonicalFileName = createGetCanonicalFileName(useCaseSensitiveFileNames);
    }

    add(filePath: string) {
        this.set.add(this.getCanonicalFileName(filePath));
    }

    has(filePath: string) {
        return this.set.has(this.getCanonicalFileName(filePath));
    }

    delete(filePath: string) {
        return this.set.delete(this.getCanonicalFileName(filePath));
    }
}
