import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    checkContentMapperConfig,
    findContentMapperCandidates,
    findProjectConfigs
} from '../../../src/plugins/typescript-go/content-mapper';
import { pathToUrl } from '../../../src/utils';

const mapper = { package: '@sveltejs/ts-content-mapper', extensions: ['.svelte'] };

function write(file: string, content: string | object) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
        file,
        typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    );
}

describe('findContentMapperCandidates', () => {
    let root: string;
    beforeEach(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-cm-scan-')));
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('only configs mentioning contentMappers and svelte (text, no parsing)', () => {
        write(path.join(root, 'tsconfig.json'), { contentMappers: [mapper] });
        write(path.join(root, 'tsconfig.node.json'), { include: ['vite.config.ts'] });
        write(path.join(root, 'tsconfig.vue.json'), {
            contentMappers: [{ package: 'vue-mapper' }]
        });
        write(path.join(root, 'jsconfig.json'), '// svelte, but no mappers');
        write(path.join(root, 'base.json'), { contentMappers: [mapper] });
        write(path.join(root, 'packages/a/tsconfig.app.json'), { contentMappers: [mapper] });
        // the recommended registration, without `extensions`
        write(path.join(root, 'packages/b/tsconfig.json'), {
            contentMappers: [{ package: '@sveltejs/ts-content-mapper' }]
        });
        const candidates = findContentMapperCandidates([{ name: '', uri: pathToUrl(root) }]);
        assert.deepStrictEqual(
            candidates.map((c) => path.relative(root, c)),
            [
                'tsconfig.json',
                path.join('packages', 'b', 'tsconfig.json'),
                path.join('packages', 'a', 'tsconfig.app.json')
            ]
        );
    });

    describe('registration inherited through extends', () => {
        const folders = () => [{ name: '', uri: pathToUrl(root) }];
        const found = () =>
            findContentMapperCandidates(folders()).map((c) => path.relative(root, c));

        it('relative, with and without .json (SvelteKit)', () => {
            write(path.join(root, '.svelte-kit/tsconfig.json'), { contentMappers: [mapper] });
            write(path.join(root, 'tsconfig.json'), { extends: './.svelte-kit/tsconfig.json' });
            write(path.join(root, 'tsconfig.app.json'), { extends: './.svelte-kit/tsconfig' });
            assert.deepStrictEqual(found(), ['tsconfig.json', 'tsconfig.app.json']);
            // the workspace config is reported, not the extended one
            assert.deepStrictEqual(checkContentMapperConfig(folders()), {
                configFile: path.join(root, 'tsconfig.json')
            });
        });

        it('a chain of two, and comments in the config', () => {
            write(path.join(root, 'configs/svelte.json'), { contentMappers: [mapper] });
            write(path.join(root, 'configs/base.json'), { extends: './svelte.json' });
            write(
                path.join(root, 'tsconfig.json'),
                '// comment\n{\n  /* c */ "extends": "./configs/base.json", // trailing\n}\n'
            );
            assert.deepStrictEqual(found(), ['tsconfig.json']);
        });

        it('an array', () => {
            write(path.join(root, 'strict.json'), { compilerOptions: { strict: true } });
            write(path.join(root, 'svelte.json'), { contentMappers: [mapper] });
            write(path.join(root, 'tsconfig.json'), {
                extends: ['./strict.json', './svelte.json']
            });
            assert.deepStrictEqual(found(), ['tsconfig.json']);
        });

        it('a package in node_modules, by name or by its tsconfig.json', () => {
            write(path.join(root, 'node_modules/@my/tsconfig/package.json'), {
                name: '@my/tsconfig'
            });
            write(path.join(root, 'node_modules/@my/tsconfig/tsconfig.json'), {
                contentMappers: [mapper]
            });
            write(path.join(root, 'tsconfig.json'), { extends: '@my/tsconfig' });
            write(path.join(root, 'app/tsconfig.json'), {
                extends: '@my/tsconfig/tsconfig.json'
            });
            assert.deepStrictEqual(found(), ['tsconfig.json', path.join('app', 'tsconfig.json')]);
        });

        it('a cycle ends, an unresolvable entry is skipped', () => {
            write(path.join(root, 'a.json'), { extends: './b.json' });
            write(path.join(root, 'b.json'), { extends: './a.json' });
            write(path.join(root, 'tsconfig.json'), { extends: './a.json' });
            write(path.join(root, 'svelte.json'), { contentMappers: [mapper] });
            write(path.join(root, 'tsconfig.app.json'), {
                extends: ['./missing.json', 'no-such-package', './svelte.json']
            });
            assert.deepStrictEqual(found(), ['tsconfig.app.json']);
        });
    });

    it('checkContentMapperConfig: on with the first candidate, off without one', () => {
        const folders = [{ name: '', uri: pathToUrl(root) }];
        assert.deepStrictEqual(checkContentMapperConfig(folders), { configFile: undefined });
        write(path.join(root, 'tsconfig.app.json'), { contentMappers: [mapper] });
        assert.deepStrictEqual(checkContentMapperConfig(folders), {
            configFile: path.join(root, 'tsconfig.app.json')
        });
    });
});

describe('findProjectConfigs', () => {
    let root: string;
    beforeEach(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-cm-scan-')));
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('finds tsconfig*/jsconfig*, shortest path first, not in node_modules or dot-directories', () => {
        for (const file of [
            'tsconfig.json',
            'tsconfig.app.json',
            'tsconfig-node.json',
            'jsconfig.json',
            'packages/a/tsconfig.json',
            'node_modules/x/tsconfig.json',
            '.svelte-kit/tsconfig.json',
            'other.json'
        ]) {
            write(path.join(root, file), {});
        }
        assert.deepStrictEqual(
            findProjectConfigs(root).map((f) => path.relative(root, f)),
            [
                'jsconfig.json',
                'tsconfig.json',
                'tsconfig.app.json',
                'tsconfig-node.json',
                path.join('packages', 'a', 'tsconfig.json')
            ]
        );
    });

    it('returns nothing for a missing folder', () => {
        assert.deepStrictEqual(findProjectConfigs(path.join(root, 'missing')), []);
    });
});
