import { dirname, resolve } from 'path';
import * as prettier from 'prettier';
import * as svelte from 'svelte/compiler';
import sveltePreprocess from 'svelte-preprocess';

export function getPackageInfo(packageName: string, fromPath: string) {
    const packageJSONPath = require.resolve(`${packageName}/package.json`, {
        paths: [fromPath, __dirname],
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { version } = require(packageJSONPath);
    const [major, minor, patch] = version.split('.');

    return {
        path: dirname(packageJSONPath),
        version: {
            full: version,
            major,
            minor,
            patch,
        },
    };
}

export function importPrettier(fromPath: string): typeof prettier {
    const pkg = getPackageInfo('prettier', fromPath);
    const main = resolve(pkg.path);
    console.log('Using Prettier v' + pkg.version.full, 'from', main);
    return require(main);
}

export function importSvelte(fromPath: string): typeof svelte {
    const pkg = getPackageInfo('svelte', fromPath);
    const main = resolve(pkg.path, 'compiler');
    console.log('Using Svelte v' + pkg.version.full, 'from', main);
    return require(main);
}

export function importSveltePreprocess(fromPath: string): typeof sveltePreprocess {
    const pkg = getPackageInfo('svelte-preprocess', fromPath);
    const main = resolve(pkg.path);
    console.log('Using svelte-preprocess v' + pkg.version.full, 'from', main);
    return require(main);
}
