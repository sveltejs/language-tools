import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import builtins from 'builtin-modules';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { createRequire } from 'module';
import { fileURLToPath } from 'url'

const DEV = !!process.env.ROLLUP_WATCH;

function repl() {
    const require = createRequire(import.meta.url);
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    require('ts-node').register({
        project: 'test/tsconfig.json',
        transpileOnly: true
    });
    const OUTDIR = path.resolve(__dirname, 'repl', 'output');

    const INPUT = path.resolve(__dirname, 'repl', 'index.svelte');
    const OUTPUT = path.resolve(__dirname, 'repl', 'output', 'code.tsx');
    const MAP = path.resolve(__dirname, 'repl', 'output', 'code.tsx.map');
    const MAPPINGS = path.resolve(__dirname, 'repl', 'output', 'mappings.jsx');

    return {
        name: 'dev-repl',
        buildStart() {
            this.addWatchFile(INPUT);
        },
        writeBundle() {
            try {
                const BUILD = require.resolve('./index.js');
                const BUILD_TEST = require.resolve('./test/build.ts');

                delete require.cache[BUILD];
                const { svelte2tsx } = require('./index.js');

                delete require.cache[BUILD_TEST];
                require.cache[BUILD_TEST] = require.cache[BUILD];
                const { process_transformed_text } = require('./test/sourcemaps/process');

                const input_content = fs.readFileSync(INPUT, 'utf-8');

                const { code, map } = svelte2tsx(input_content);

                map.file = 'code.tsx';
                map.sources = ['index.svelte'];
                map.sourcesContent = [input_content];

                if (!fs.existsSync(OUTDIR)) {
                    fs.mkdirSync(OUTDIR);
                }
                fs.writeFileSync(OUTPUT, code);
                fs.writeFileSync(MAP, map.toString());

                try {
                    const mappings = process_transformed_text(
                        input_content,
                        code, // @ts-expect-error
                        decode(map.mappings)
                    ).print_mappings();

                    fs.writeFileSync(MAPPINGS, mappings);
                } catch (e) {
                    fs.writeFileSync(MAPPINGS, e.toString());
                }
            } catch (e) {
                fs.writeFileSync(OUTPUT, e.toString());
                fs.writeFileSync(MAPPINGS, e.toString());
            }
        }
    };
}
export default [
    {
        input: 'src/index.ts',
        output: [
            {
                exports: 'auto',
                sourcemap: true,
                format: 'commonjs',
                file: 'index.js'
            },
            {
                exports: 'auto',
                file: 'index.mjs',
                format: 'esm'
            }
        ],
        plugins: [
            resolve({ browser: false, preferBuiltins: true }),
            commonjs(),
            json(),
            typescript(),
            DEV && repl()
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
