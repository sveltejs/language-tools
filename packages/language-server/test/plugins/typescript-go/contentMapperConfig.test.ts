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
