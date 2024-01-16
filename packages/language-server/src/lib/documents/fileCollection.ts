import ts from 'typescript';
import { createGetCanonicalFileName, GetCanonicalFileName } from '../../utils';

/**
 * wrapper around Map<string, T> for case insensitive file systems
 */
export class FileMap<T> implements Iterable<[string, T]> {
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

    values() {
        return this.map.values();
    }

    clear() {
        this.map.clear();
    }

    /**
     * Returns an iterable of values in the map.
     * In case insensitive file system the key is in lowercase
     */
    keys() {
        return this.map.keys();
    }

    get size() {
        return this.map.size;
    }

    [Symbol.iterator](): Iterator<[string, T]> {
        return this.map[Symbol.iterator]();
    }
}

export class FileSet implements Iterable<string> {
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

    clear() {
        this.set.clear();
    }

    [Symbol.iterator](): Iterator<string> {
        return this.set[Symbol.iterator]();
    }
}
