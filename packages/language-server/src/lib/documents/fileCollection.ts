import ts from 'typescript';
import { createGetCanonicalFileName, GetCanonicalFileName } from '../../utils';

/**
 * wrapper around Map<string, T> for
 * case case insensitive file system
 */
export class FileMap<T> {
    private getCanonicalFileName: GetCanonicalFileName;
    private readonly map = new Map<string, T>();

    constructor(useCaseSensitiveFileNames = ts.sys.useCaseSensitiveFileNames) {
        this.getCanonicalFileName = createGetCanonicalFileName(useCaseSensitiveFileNames);
    }

    get(filePath: string) {
        return this.map.get(this.getCanonicalFileName(filePath));
    }

    set(filePath: string, value: T) {
        const canonicalFileName = this.getCanonicalFileName(filePath);

        return this.map.set(canonicalFileName, value);
    }

    has(filePath: string) {
        return this.map.has(this.getCanonicalFileName(filePath));
    }

    delete(filePath: string) {
        return this.map.delete(this.getCanonicalFileName(filePath));
    }

    /**
     * Returns an iterable of key, value pairs for every entry in the map.
     * In case insensitive file system the key in the key-value pairs is in lowercase
     */
    entries(): IterableIterator<[string, T]> {
        return this.map.entries();
    }

    /**
     *
     * @param callbackfn In case insensitive file system the key parameter for the callback is in lowercase
     */
    forEach(callbackfn: (value: T, key: string) => void) {
        return this.map.forEach(callbackfn);
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
