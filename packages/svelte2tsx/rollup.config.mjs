import { builtinModules } from 'node:module';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const DEV = !!process.env.ROLLUP_WATCH;

/** @returns {import('rollup').Plugin} */
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
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src');

/**
 * The internal modules (`dist/*`):
 * - `common`: svelte2tsx itself, which doesn't depend on TypeScript; the TypeScript facade is passed in
 * - `ts-facade`: the TypeScript facade implemented with TypeScript 6 (`typescript`)
 * - `tsgo-facade`: the TypeScript facade implemented with TypeScript 7 (`typescript/ast`, `typescript/sync`)
 *
 * The entry points combine them: `index` (`svelte2tsx`) uses `ts-facade`, `tsgo` (`svelte2tsx/tsgo`) uses `tsgo-facade`.
 */
function internalModule(id) {
    const file = path.relative(srcDir, id).replace(/\\/g, '/');
    if (file === 'ts-facade.ts') return 'ts-facade';
    if (file === 'tsgo-facade.ts') return 'tsgo-facade';
    // entry point specific
    if (file === 'index.ts' || file === 'tsgo.ts' || file === 'emitDts.ts') return undefined;
    // everything else, including bundled dependencies
    return 'common';
}

/**
 * Makes sure that `svelte2tsx/tsgo` never loads TypeScript 6.
 * @returns {import('rollup').Plugin}
 */
function checkTypeScriptBoundary() {
    return {
        name: 'check-typescript-boundary',
        generateBundle(_, bundle) {
            const chunks = new Map(
                Object.values(bundle)
                    .filter((file) => file.type === 'chunk')
                    .map((chunk) => [chunk.fileName, chunk])
            );
            const dependsOnTs6 = (chunk, seen = new Set()) => {
                if (seen.has(chunk.fileName)) return false;
                seen.add(chunk.fileName);
                const imports = [...chunk.imports, ...chunk.dynamicImports];
                return (
                    chunk.name === 'ts-facade' ||
                    imports.some((id) => id === 'typescript' || id.startsWith('typescript/')) ||
                    imports.some((id) => chunks.has(id) && dependsOnTs6(chunks.get(id), seen))
                );
            };
            for (const chunk of chunks.values()) {
                if (['common', 'tsgo-facade', 'tsgo'].includes(chunk.name) && dependsOnTs6(chunk)) {
                    this.error(`${chunk.fileName} must not depend on the 'typescript' package`);
                }
            }
        }
    };
}

export default [
    {
        input: { index: 'src/index.ts', tsgo: 'src/tsgo.ts' },
        output: [
            {
                dir: '.',
                exports: 'auto',
                sourcemap: true,
                format: 'commonjs',
                entryFileNames: '[name].js',
                chunkFileNames: 'dist/[name].js',
                manualChunks: internalModule
            },
            {
                dir: '.',
                exports: 'auto',
                format: 'esm',
                entryFileNames: '[name].mjs',
                chunkFileNames: 'dist/[name].mjs',
                manualChunks: internalModule
            }
        ],
        plugins: [
            resolve({ browser: false, preferBuiltins: true }),
            commonjs(),
            json(),
            typescript(),
            checkTypeScriptBoundary(),
            DEV && repl()
        ],
        watch: {
            clearScreen: false
        },
        external: [
            ...builtinModules,
            'typescript',
            'svelte',
            'svelte/compiler',
            'dedent-js',
            'scule'
        ]
    }
];
