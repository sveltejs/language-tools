import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateConfig } from '../../src/sveltekit/generateFiles/types';

type MockConfig = {
    tsconfig?: boolean;
    jsconfig?: boolean;
    svelteVersion?: string;
    svelteKitVersion?: string;
    tsVersion?: string;
};

function setupMocks(config: MockConfig = {}) {
    const { tsconfig, jsconfig, svelteVersion, svelteKitVersion } = config;

    // Default package.json with versions
    const defaultPackageJson = {
        dependencies: {
            svelte: svelteVersion,
            '@sveltejs/kit': svelteKitVersion
        }
    };

    vi.doMock('vscode', () => ({
        Uri: { file: vi.fn((path) => ({ path })) },
        workspace: {
            fs: {
                stat: vi.fn().mockImplementation((uri) => {
                    const path = uri.path || uri.toString();

                    // Mock config file existence based on configuration
                    if (path.endsWith('tsconfig.json') && tsconfig) {
                        return Promise.resolve({ type: 1 }); // File exists
                    }
                    if (path.endsWith('jsconfig.json') && jsconfig) {
                        return Promise.resolve({ type: 1 }); // File exists
                    }
                    return Promise.reject(new Error('File not found'));
                }),
                readFile: vi
                    .fn()
                    .mockResolvedValue(new TextEncoder().encode(JSON.stringify(defaultPackageJson)))
            },
            findFiles: vi.fn().mockReturnValue([{ path: '/fake/package.json' }])
        }
    }));
}

describe('checkProjectKind', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    const combinations: [string, MockConfig, keyof GenerateConfig['kind'], boolean][] = [
        // by default
        ['default to js', {}, 'withTs', false],
        ['default to runes', {}, 'withRunes', true],
        ['default to not satisfies', {}, 'withSatisfies', false],
        ['default to withProps', {}, 'withProps', true],

        ['js', { jsconfig: true }, 'withTs', false],

        ['ts', { tsconfig: true }, 'withTs', true],
        ['ts', { tsconfig: true }, 'withSatisfies', true],
        ['ts', { tsconfig: true, tsVersion: '3.0' }, 'withSatisfies', false]

        // ['ts with jsconfig', { has_ts_config: true, has_js_config: true }, 'withTs', true],
        // ['ts with jsconfig', { has_ts_config: true, has_js_config: true }, 'withTs', true]
    ];

    for (const [name, config, ex, toBe] of combinations) {
        it(name, async () => {
            setupMocks(config);

            const utils = await import('../../src/sveltekit/utils');
            const result = await utils.checkProjectKind('/test/path');

            expect(result[ex]).toBe(toBe);
        });
    }
});
