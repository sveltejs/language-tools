import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import cleanup from 'rollup-plugin-cleanup';
import builtins from 'builtin-modules';

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                sourcemap: false,
                format: 'cjs',
                file: 'dist/src/index.js'
            }
        ],
        plugins: [
            // The replace-steps are a hacky workaround to not transform the dynamic
            // requires inside importPackage.ts of svelte-language-server in any way
            replace({
                'return require(dynamicFileToRequire);': 'return "XXXXXXXXXXXXXXXXXXXXX";',
                delimiters: ['', '']
            }),
            resolve({ browser: false, preferBuiltins: true }),
            commonjs(),
            json(),
            typescript(),
            replace({
                'return "XXXXXXXXXXXXXXXXXXXXX";': 'return require(dynamicFileToRequire);',
                delimiters: ['', '']
            }),
            cleanup({ comments: ['some', 'ts', 'ts3s'] })
        ],
        watch: {
            clearScreen: false
        },
        external: [
            ...builtins,
            // svelte-check dependencies that are system-dependent and should
            // be installed as dependencies through npm
            'chalk',
            'chokidar',
            // Dependencies of svelte-language-server
            // we don't want to bundle and instead require them as dependencies
            'typescript',
            'svelte',
            'svelte-preprocess',
            'import-fresh', // because of https://github.com/sindresorhus/import-fresh/issues/18
            'source-map'
        ]
    }
];
