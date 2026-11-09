import { builtinModules } from 'node:module';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import cleanup from 'rollup-plugin-cleanup';
import copy from 'rollup-plugin-copy';

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                sourcemap: false,
                format: 'cjs',
                // Code-split: the TypeScript 6 path (ts6.ts, the default) and the TypeScript 7 path
                // (ts7/) are separate chunks, loaded on demand by the entry. Only the TS6 chunk (and
                // what only it uses) requires `typescript` when it's loaded.
                dir: 'dist/src',
                entryFileNames: 'index.js',
                chunkFileNames: (chunk) => {
                    const facade = chunk.facadeModuleId?.replace(/\\/g, '/') ?? '';
                    if (facade.endsWith('/src/ts6.ts')) {
                        return 'ts6.js';
                    }
                    if (facade.endsWith('/src/ts7/index.ts')) {
                        return 'ts7.js';
                    }
                    if (
                        chunk.moduleIds.some((id) =>
                            /\/svelte2tsx\/index\.m?js$/.test(id.replace(/\\/g, '/'))
                        )
                    ) {
                        return 'svelte2tsx.js';
                    }
                    return '[name].js';
                }
            }
        ],
        plugins: [
            replace({
                // This replace-step is a hacky workaround to not transform the dynamic
                // requires inside importPackage.ts of svelte-language-server in any way
                'return require(dynamicFileToRequire);': 'return "XXXXXXXXXXXXXXXXXXXXX";',
                delimiters: ['', '']
            }),
            resolve({ browser: false, preferBuiltins: true }),
            commonjs({
                // Leave `require('typescript')` where it is. Otherwise the plugin hoists lazy
                // requires (inside functions) to the top of the chunk, and the TS7 path would load
                // TypeScript 6 at startup through modules it shares with the TS6 path.
                ignore: ['typescript']
            }),
            json(),
            typescript(),
            replace({
                // This replace-step is a hacky workaround to not transform the dynamic
                // requires inside importPackage.ts of svelte-language-server in any way
                'return "XXXXXXXXXXXXXXXXXXXXX";': 'return require(dynamicFileToRequire);',
                delimiters: ['', '']
            }),
            cleanup({ comments: ['some', 'ts', 'ts3s'] }),
            copy({
                targets: [
                    // copy over d.ts files of svelte2tsx
                    {
                        src: [
                            // workspace
                            '../svelte2tsx/svelte*.d.ts',
                            // standalone
                            'node_modules/svelte2tsx/svelte*.d.ts'
                        ],
                        dest: 'dist/src'
                    }
                ]
            })
        ],
        watch: {
            clearScreen: false
        },
        external: [
            ...builtinModules,
            // svelte-check dependencies that are system-dependent and should
            // be installed as dependencies through npm
            'picocolors',
            'chokidar',
            // Dependencies of svelte-language-server
            // we don't want to bundle and instead require them as dependencies
            '@typescript/native/vscode',
            '@typescript/native/async',
            '@typescript/native/ast',
            'typescript',
            'sade',
            '@sveltejs/load-config',
            'svelte',
            'svelte/compiler',
            '@jridgewell/trace-mapping'
            // import-fresh removed some time ago, no dependency uses it anymore.
            // if it creeps back in check if the dependency uses a version that
            // fixed https://github.com/sindresorhus/import-fresh/issues/18
        ]
    }
];
