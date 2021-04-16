import { dirname, resolve } from 'path';
import * as prettier from 'prettier';
import * as svelte from 'svelte/compiler';
import sveltePreprocess from 'svelte-preprocess';
import { Logger } from './logger';

/**
 * This function encapsulates the require call in one place
 * so we can replace its content inside rollup builds
 * so it's not transformed.
 */
function dynamicRequire(dynamicFileToRequire: string): any {
	// prettier-ignore
	return require(dynamicFileToRequire);
}

export function getPackageInfo(packageName: string, fromPath: string) {
	const packageJSONPath = require.resolve(`${packageName}/package.json`, {
		paths: [fromPath, __dirname]
	});
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { version } = dynamicRequire(packageJSONPath);
	const [major, minor, patch] = version.split('.');

	return {
		path: dirname(packageJSONPath),
		version: {
			full: version,
			major,
			minor,
			patch
		}
	};
}

export function importPrettier(fromPath: string): typeof prettier {
	const pkg = getPackageInfo('prettier', fromPath);
	const main = resolve(pkg.path);
	Logger.log('Using Prettier v' + pkg.version.full, 'from', main);
	return dynamicRequire(main);
}

export function importSvelte(fromPath: string): typeof svelte {
	const pkg = getPackageInfo('svelte', fromPath);
	const main = resolve(pkg.path, 'compiler');
	Logger.log('Using Svelte v' + pkg.version.full, 'from', main);
	return dynamicRequire(main);
}

export function importSveltePreprocess(fromPath: string): typeof sveltePreprocess {
	const pkg = getPackageInfo('svelte-preprocess', fromPath);
	const main = resolve(pkg.path);
	Logger.log('Using svelte-preprocess v' + pkg.version.full, 'from', main);
	return dynamicRequire(main);
}
