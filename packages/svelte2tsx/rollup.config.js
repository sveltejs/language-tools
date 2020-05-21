import typescript from 'rollup-plugin-typescript';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import json from 'rollup-plugin-json';
import builtins from 'builtin-modules'

export default [{
	input: 'src/index.ts',
	output: [{
		sourcemap: true,
		format: 'commonjs',
		file: 'index.js'
	},{
		file: 'index.mjs',
		format: 'esm'
	}],
	plugins: [
		resolve({ browser: false, preferBuiltins: true }),
		commonjs(),
		json(),
		typescript()
	],
	watch: {
		clearScreen: false
	},
	external: [...builtins, 'typescript', 'svelte', 'svelte/compiler']
}];
