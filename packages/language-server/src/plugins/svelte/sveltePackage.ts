import { dirname, resolve } from 'path';
import * as svelte from 'svelte/compiler';

export function getSveltePackageInfo(fromPath: string) {
    const packageJSONPath = require.resolve('svelte/package.json', {
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

export function importSvelte(fromPath: string): typeof svelte {
    const pkg = getSveltePackageInfo(fromPath);
    const main = resolve(pkg.path, 'compiler');
    console.log('Using Svelte v' + pkg.version.full, 'from', main);
    return require(main);
}
