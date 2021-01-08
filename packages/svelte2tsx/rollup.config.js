import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import builtins from 'builtin-modules';
import fs from 'fs';
import path from 'path';

function repl() {
    return {
        name: 'dev-repl',
        buildStart() {
            this.addWatchFile('./repl/index.svelte');
        },
        writeBundle() {
            if (!this.meta.watchMode) return;

            const repl = `${__dirname}/repl/`;
            const output = `${__dirname}/repl/output/`;

            delete require.cache[path.resolve(__dirname, 'index.js')];
            const svelte2tsx = require('./index.js');

            const tsx = svelte2tsx(fs.readFileSync(`${repl}/index.svelte`, 'utf-8'));

            if (!fs.existsSync(output)) fs.mkdirSync(output);
            fs.writeFileSync(`${repl}/output/code.tsx`, tsx.code);
        }
    };
}
export default [
    {
        input: 'src/index.ts',
        output: [
            {
                sourcemap: true,
                format: 'commonjs',
                file: 'index.js'
            },
            {
                file: 'index.mjs',
                format: 'esm'
            }
        ],
        plugins: [
            resolve({ browser: false, preferBuiltins: true }),
            commonjs(),
            json(),
            typescript({ include: ['src/**/*'] }),
            repl()
        ],
        watch: {
            clearScreen: false
        },
        external: [
            ...builtins,
            'typescript',
            'svelte',
            'svelte/compiler',
            'dedent-js',
            'pascal-case'
        ]
    }
];
