require("esbuild").context({
	entryPoints: {
		client: './out/extension.js',
		server: './node_modules/svelte-language-server/bin/server.js',
	},
	bundle: true,
	metafile: process.argv.includes('--metafile'),
	outdir: './dist',
	external: [
		'vscode',
	],
	format: 'cjs',
	platform: 'node',
	tsconfig: './tsconfig.json',
	define: { 'process.env.NODE_ENV': '"production"' },
	minify: process.argv.includes('--minify'),
	plugins: [
		{
			name: 'umd2esm',
			setup(build) {
				build.onResolve({ filter: /^(vscode-.*-languageservice|jsonc-parser)/ }, args => {
					const pathUmdMay = require.resolve(args.path, { paths: [args.resolveDir] });
					// Call twice the replace is to solve the problem of the path in Windows
					const pathEsm = pathUmdMay.replace('/umd/', '/esm/').replace('\\umd\\', '\\esm\\');
					return { path: pathEsm };
				});
			},
		},
	],
}).then(async ctx => {
	console.log('building...');
	if (process.argv.includes('--watch')) {
		await ctx.watch();
		console.log('watching...');
	} else {
		await ctx.rebuild();
		await ctx.dispose();
		console.log('finished.');
	}
});

require("esbuild").build({
	bundle: true,
	entryPoints: ['./node_modules/typescript-svelte-plugin/out/index.js'],
	outfile: './node_modules/typescript-svelte-plugin-bundled/index.js',
	logLevel: 'info',
	platform: 'node',
	target: 'node16',
	plugins: [
		{
			name: 'alias',
			setup({ onResolve, resolve }) {
				onResolve({ filter: /^(jsonc-parser)$/ }, ({ path, ...options }) =>
					resolve(require.resolve(path).replace(/\/umd\//, '/esm/'), options)
				)
				onResolve({ filter: /\/umd\// }, ({ path, ...options }) =>
					resolve(path.replace(/\/umd\//, '/esm/'), options)
				)
			}
		}
	]
})
