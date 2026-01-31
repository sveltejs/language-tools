import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenerateConfig } from '../../src/sveltekit/generateFiles/types';

type MockConfig = {
    tsconfig?: boolean;
    jsconfig?: boolean;
    svelteVersion?: string;
    svelteKitVersion?: string;
    tsVersion?: string;
};

function setupMocks(config: MockConfig = {}) {
    vi.resetModules(); // Reset modules before setting up new mocks

    const { tsconfig, jsconfig, svelteVersion, svelteKitVersion, tsVersion } = config;

    // Default package.json with versions
    const defaultPackageJson = {
        dependencies: {
            svelte: svelteVersion,
            '@sveltejs/kit': svelteKitVersion
        }
    };

    // Mock TypeScript package for version detection if tsVersion is provided
    if (tsVersion) {
        // Override Module._resolveFilename if available to intercept require.resolve calls
        const Module = require('module');
        const originalResolveFilename = Module._resolveFilename;

        Module._resolveFilename = function (
            request: string,
            parent: any,
            isMain: boolean,
            options?: any
        ) {
            if (request === 'typescript/package.json') {
                return '/fake/typescript/package.json';
            }
            return originalResolveFilename.call(this, request, parent, isMain, options);
        };

        // Override Module._load to provide the mock package.json content
        const originalLoad = Module._load;
        Module._load = function (id: string, parent: any, isMain: boolean) {
            if (id === '/fake/typescript/package.json') {
                return { version: tsVersion };
            }
            return originalLoad.call(this, id, parent, isMain);
        };
    }

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
        ['ts satisfies (default)', { tsconfig: true }, 'withSatisfies', true],
        ['ts not satisfies', { tsconfig: true, tsVersion: '3.0' }, 'withSatisfies', false],
        ['ts satisfies', { tsconfig: true, tsVersion: '4.9' }, 'withSatisfies', true],
        ['ts not satisfies major', { tsconfig: true, tsVersion: '4' }, 'withSatisfies', false],
        ['ts not satisfies minor', { tsconfig: true, tsVersion: '4.8' }, 'withSatisfies', false],

        ['no runes 1', { svelteVersion: '1' }, 'withRunes', false],
        ['no runes 4', { svelteVersion: '4.99' }, 'withRunes', false],
        ['runes 12', { svelteVersion: '12' }, 'withRunes', true],
        ['runes 12', { svelteVersion: '5.0' }, 'withRunes', true],

        ['no sveltekit', { svelteKitVersion: '1' }, 'withProps', false],
        ['no sveltekit', { svelteKitVersion: '2' }, 'withProps', false],
        ['sveltekit', { svelteKitVersion: '2.15' }, 'withProps', false],
        ['sveltekit', { svelteKitVersion: '2.16' }, 'withProps', true],
        ['sveltekit', { svelteKitVersion: '3' }, 'withProps', true]
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
