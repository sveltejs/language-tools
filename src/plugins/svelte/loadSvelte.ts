import { dirname, resolve } from 'path';

export function loadSvelte(fromPath: string) {
    const packageJSONPath = require.resolve('svelte/package.json', {
        paths: [fromPath, __dirname],
    })
    const {version} = require(packageJSONPath);
    const [major, minor, patch] = version.split('.');

    let packagePath = dirname(packageJSONPath);

    if (major > 2) {
        packagePath = resolve(packagePath, 'compiler');
    }

    console.log('Using Svelte v' + version, 'from', packagePath);

    return require(packagePath);
}
