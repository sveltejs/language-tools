import assert from 'assert';
import { FileMap, FileSet } from '../../../src/lib/documents/fileCollection';

describe('fileCollection', () => {
    describe('FileSet', () => {
        it('has (case sensitive)', () => {
            const set = new FileSet(/** useCaseSensitiveFileNames */ true);

            set.add('hi.svelte');

            assert.strictEqual(set.has('Hi.svelte'), false);
            assert.ok(set.has('hi.svelte'));
        });

        it('delete (case sensitive)', () => {
            const set = new FileSet(/** useCaseSensitiveFileNames */ true);

            set.add('hi.svelte');

            assert.strictEqual(set.delete('Hi.svelte'), false);
            assert.ok(set.delete('hi.svelte'));
        });

        it('has (case insensitive)', () => {
            const set = new FileSet(/** useCaseSensitiveFileNames */ false);

            set.add('hi.svelte');

            assert.ok(set.has('Hi.svelte'));
        });

        it('delete (case sensitive)', () => {
            const set = new FileSet(/** useCaseSensitiveFileNames */ false);

            set.add('hi.svelte');

            assert.ok(set.delete('Hi.svelte'));
        });
    });

    describe('FileMap', () => {
        it('has (case sensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ true);
            const info = {};

            map.set('hi.svelte', info);

            assert.strictEqual(map.has('Hi.svelte'), false);
            assert.ok(map.has('hi.svelte'));
        });

        it('get (case sensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ true);
            const info = {};

            map.set('hi.svelte', info);

            assert.strictEqual(map.get('Hi.svelte'), undefined);
            assert.strictEqual(map.get('hi.svelte'), info);
        });

        it('delete (case sensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ true);
            const info = {};

            map.set('hi.svelte', info);

            assert.strictEqual(map.delete('Hi.svelte'), false);
            assert.ok(map.has('hi.svelte'));
        });

        it('has (case insensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ false);
            const info = {};

            map.set('hi.svelte', info);

            assert.ok(map.has('Hi.svelte'));
        });

        it('get (case insensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ false);
            const info = {};

            map.set('hi.svelte', info);

            assert.strictEqual(map.get('Hi.svelte'), info);
        });

        it('delete (case insensitive)', () => {
            const map = new FileMap(/** useCaseSensitiveFileNames */ false);
            const info = {};

            map.set('hi.svelte', info);

            assert.strictEqual(map.delete('Hi.svelte'), true);
        });
    });
});
