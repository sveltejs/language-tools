import { describe, it, expect } from 'vitest';
import { FileMap, FileSet } from '../../../src/lib/documents/fileCollection';

describe('fileCollection', () => {
    describe('FileSet', () => {
        it('has (case sensitive)', () => {
            const set = new FileSet(/** useCaseSensitiveFileNames */ true);

            set.add('hi.svelte');

            expect(set.has('Hi.svelte')).toBe(false);
            expect(set.has('hi.svelte')).toBeTruthy();
        });

        it('delete (case sensitive)', () => {
            const set = new FileSet(/** useCaseSensitiveFileNames */ true);

            set.add('hi.svelte');

            expect(set.delete('Hi.svelte')).toBe(false);
            expect(set.delete('hi.svelte')).toBeTruthy();
        });

        it('has (case insensitive)', () => {
            const set = new FileSet(/** useCaseSensitiveFileNames */ false);

            set.add('hi.svelte');

            expect(set.has('Hi.svelte')).toBeTruthy();
        });

        it('delete (case sensitive)', () => {
            const set = new FileSet(/** useCaseSensitiveFileNames */ false);

            set.add('hi.svelte');

            expect(set.delete('Hi.svelte')).toBeTruthy();
        });
    });

    describe('FileMap', () => {
        it('has (case sensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ true);
            const info = {};

            map.set('hi.svelte', info);

            expect(map.has('Hi.svelte')).toBe(false);
            expect(map.has('hi.svelte')).toBeTruthy();
        });

        it('get (case sensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ true);
            const info = {};

            map.set('hi.svelte', info);

            expect(map.get('Hi.svelte')).toBe(undefined);
            expect(map.get('hi.svelte')).toBe(info);
        });

        it('delete (case sensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ true);
            const info = {};

            map.set('hi.svelte', info);

            expect(map.delete('Hi.svelte')).toBe(false);
            expect(map.has('hi.svelte')).toBeTruthy();
        });

        it('has (case insensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ false);
            const info = {};

            map.set('hi.svelte', info);

            expect(map.has('Hi.svelte')).toBeTruthy();
        });

        it('get (case insensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ false);
            const info = {};

            map.set('hi.svelte', info);

            expect(map.get('Hi.svelte')).toBe(info);
        });

        it('delete (case insensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ false);
            const info = {};

            map.set('hi.svelte', info);

            expect(map.delete('Hi.svelte')).toBe(true);
        });
    });
});
