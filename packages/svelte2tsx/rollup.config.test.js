import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import del from 'rollup-plugin-delete';
import builtins from 'builtin-modules';
import fs from 'fs';

function generateFile(file, x) {
    return {
        writeBundle() {
            if (!process.env.CI) {
                fs.writeFileSync(file, x);
            }
        }
    };
}

export default [
    {
        input: ['src/index.ts'],
        output: {
            sourcemap: true,
            format: 'commonjs',
            file: 'test/build/index.js'
        },
        plugins: [
            del({ targets: 'test/build/index.*' }),
            resolve({ browser: false, preferBuiltins: true }),
            commonjs(),
            json(),
            typescript({ include: ['src/**/*'] }),
            generateFile(`test/build/index.d.ts`, `export { default } from '../../index';`)
        ],
        external: [...builtins, 'typescript', 'svelte', 'svelte/compiler', 'magic-string']
    },
    {
        input: ['src/htmlxtojsx/index.ts'],
        output: {
            sourcemap: true,
            format: 'commonjs',
            file: 'test/build/htmlxtojsx.js'
        },
        plugins: [
            del({ targets: 'test/build/htmlxtojsx.*' }),
            resolve({ browser: false, preferBuiltins: true }),
            commonjs(),
            json(),
            typescript({ include: ['src/**/*'] }),
            generateFile(`test/build/htmlxtojsx.d.ts`, `export * from '../../src/htmlxtojsx/index';`)
        ],
        external: [...builtins, 'typescript', 'svelte', 'svelte/compiler', 'magic-string']
    }
];
