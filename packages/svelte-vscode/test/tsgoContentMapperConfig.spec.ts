import { describe, expect, it } from 'vitest';
import {
    getContentMapperConfigHint,
    getContentMapperConfigSnippet,
    getUnsupportedTsServerMessage,
    RECOMMENDED_CONTENT_MAPPER_REGISTRATION,
    supportsContentMappers
} from '../src/typescript-go/contentMapperConfig';

describe('tsgo: supportsContentMappers', () => {
    it.each([
        ['7.1.0-dev.20261125.1', true],
        ['7.1.0-beta', true],
        ['7.1.0', true],
        ['7.2.0', true],
        ['8.0.0', true],
        ['7.0.2', false],
        ['7.0.0-dev.20250101.1', false],
        ['6.0.3', false],
        ['', undefined],
        [undefined, undefined],
        ['nightly', undefined]
    ])('%s => %s', (version, expected) => {
        expect(supportsContentMappers(version)).toBe(expected);
    });

    it('names the version in the warning', () => {
        expect(getUnsupportedTsServerMessage('7.0.2')).toContain('7.0.2');
        expect(getUnsupportedTsServerMessage('7.0.2')).toContain('7.1');
    });
});

describe('tsgo: content mapper config hint', () => {
    it('snippet is valid JSON for the recommended registration', () => {
        const snippet = getContentMapperConfigSnippet();
        expect(snippet).toBe('"contentMappers": [{ "package": "@sveltejs/ts-content-mapper" }]');
        expect(JSON.parse(`{${snippet}}`)).toEqual({
            contentMappers: [RECOMMENDED_CONTENT_MAPPER_REGISTRATION]
        });
    });

    it('no hint when content mapper mode is on or there is no status', () => {
        expect(getContentMapperConfigHint({ configFile: '/a/tsconfig.json' })).toBeUndefined();
        expect(getContentMapperConfigHint(undefined)).toBeUndefined();
    });

    it('missing config: says what to add', () => {
        const hint = getContentMapperConfigHint({})!;
        expect(hint).toContain(getContentMapperConfigSnippet());
        expect(hint).toContain('@sveltejs/ts-content-mapper');
        expect(hint).toContain('tsconfig*.json or jsconfig*.json of the workspace');
    });
});
