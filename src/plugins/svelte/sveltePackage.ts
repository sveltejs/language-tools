import { dirname, resolve } from 'path';

export function getSveltePackageInfo(fromPath: string) {
    const packageJSONPath = require.resolve('svelte/package.json', {
        paths: [fromPath, __dirname],
    });
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

export function importSvelte(fromPath: string) {
    const pkg = getSveltePackageInfo(fromPath);

    let main = pkg.path;
    if (pkg.version.major > 2) {
        main = resolve(pkg.path, 'compiler');
    }

    console.log('Using Svelte v' + pkg.version.full, 'from', main);

    return require(main);
}
