import typescript from 'rollup-plugin-typescript';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import json from 'rollup-plugin-json';
import del from 'rollup-plugin-delete';
import builtins from 'builtin-modules'

export default {
	input: ['src/index.ts', 'src/htmlxtojsx.ts'],
	output: {
		sourcemap: true,
		format: 'commonjs',
		dir: 'test/build'
	},
	plugins: [
		del({ targets: 'test/build/*' }),
		resolve({ browser: false, preferBuiltins: true }),
		commonjs(),
		json(),
		typescript()
	],
	external: [...builtins, 'typescript', 'svelte', 'svelte/compiler', 'parse5', 'magic-string']
};
