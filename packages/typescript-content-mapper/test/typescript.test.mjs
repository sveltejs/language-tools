// Which TypeScript the mapper parses with (`src/typescript.ts`)
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { findTypeScript, isAtLeast71 } from '../dist/typescript.js';
import { createProject } from './utils.mjs';

describe('findTypeScript', () => {
    it("uses the project's typescript if it's TypeScript 7.1", () => {
        const dir = createProject({ typescript: '7.1.0-dev.20261125.1' });
        const found = findTypeScript([dir], {});
        assert.equal(found.packageDir, path.join(dir, 'node_modules', 'typescript'));
        assert.equal(found.version, '7.1.0-dev.20261125.1');
    });

    it('uses @typescript/native when typescript is TypeScript 6', () => {
        const dir = createProject({ typescript: '6.0.3', '@typescript/native': '7.1.0-beta' });
        const found = findTypeScript([dir], {});
        assert.equal(found.packageDir, path.join(dir, 'node_modules', '@typescript/native'));
        assert.equal(found.version, '7.1.0-beta');
    });

    it('prefers typescript when both are TypeScript 7.1', () => {
        const dir = createProject({ typescript: '7.1.2', '@typescript/native': '7.1.0-beta' });
        assert.equal(findTypeScript([dir], {}).version, '7.1.2');
    });

    it("prefers anything in the project over the mapper's directory", () => {
        // the project only has the alias, the mapper's directory has `typescript`
        const project = createProject({ '@typescript/native': '7.1.0-beta' });
        const mapper = createProject({ typescript: '7.1.0' });
        assert.equal(
            findTypeScript([project, mapper], {}).packageDir,
            path.join(project, 'node_modules', '@typescript/native')
        );
    });

    it('looks in the next directory when the project has none', () => {
        const project = createProject({});
        const fallback = createProject({ typescript: '7.1.0' });
        assert.equal(
            findTypeScript([project, fallback], {}).packageDir,
            path.join(fallback, 'node_modules', 'typescript')
        );
    });

    it('never uses TypeScript 6 or 7.0, and says what it found', () => {
        const dir = createProject({ typescript: '6.0.3', '@typescript/native': '7.0.2' });
        assert.throws(
            () => findTypeScript([dir], {}),
            (error) => {
                assert.match(error.message, /needs TypeScript 7\.1 or newer/);
                assert.match(error.message, /'typescript' is TypeScript 6\.0\.3/);
                assert.match(error.message, /'@typescript\/native' is TypeScript 7\.0\.2/);
                return true;
            }
        );
    });

    it('reports when there is no TypeScript at all', () => {
        assert.throws(() => findTypeScript([createProject({})], {}), /Found none\./);
    });

    describe('SVELTE_CONTENT_MAPPER_TYPESCRIPT', () => {
        it('takes a module specifier', () => {
            const dir = createProject({ typescript: '7.1.0', '@typescript/native': '7.1.1' });
            const env = { SVELTE_CONTENT_MAPPER_TYPESCRIPT: '@typescript/native' };
            assert.equal(findTypeScript([dir], env).version, '7.1.1');
        });

        it('takes the absolute path of a package directory', () => {
            const dir = createProject({ typescript: '6.0.3' });
            const other = createProject({ typescript: '7.1.0-dev.20261125.1' });
            const env = {
                SVELTE_CONTENT_MAPPER_TYPESCRIPT: path.join(other, 'node_modules', 'typescript')
            };
            assert.equal(
                findTypeScript([dir], env).packageDir,
                path.join(other, 'node_modules', 'typescript')
            );
        });

        it("doesn't fall back to the project when it's wrong", () => {
            const dir = createProject({ typescript: '7.1.0', '@typescript/native': '6.0.3' });
            assert.throws(
                () =>
                    findTypeScript([dir], {
                        SVELTE_CONTENT_MAPPER_TYPESCRIPT: '@typescript/native'
                    }),
                /is set to '@typescript\/native', which is TypeScript 6\.0\.3/
            );
            assert.throws(
                () =>
                    findTypeScript([dir], { SVELTE_CONTENT_MAPPER_TYPESCRIPT: '/does/not/exist' }),
                /no TypeScript package was found there/
            );
        });
    });
});

describe('isAtLeast71', () => {
    for (const [version, expected] of [
        ['7.1.0-beta', true],
        ['7.1.0-dev.20261125.1', true],
        ['7.1.0', true],
        ['7.2.0', true],
        ['8.0.0', true],
        ['7.0.2', false],
        ['7.0.0-dev.20260614.1', false],
        ['6.0.3', false]
    ]) {
        it(`${version}: ${expected}`, () => assert.equal(isAtLeast71(version), expected));
    }
});
