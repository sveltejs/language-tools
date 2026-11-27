const { dirname } = require('path');
const { join } = require('path');

require('ts-node').register({
    project: 'test/tsconfig.json',
    transpileOnly: true
});
require('source-map-support').install();
const glob = require('tiny-glob/sync');

//console.clear();

if (process.env.CI) {
    const arr = glob('**/*.solo', { cwd: 'test' });
    if (arr.length) throw new Error(`Forgot to remove ".solo" from test(s) ${arr}`);
}

let test_folders = glob('*/index.ts', { cwd: 'test' });

// With TypeScript 7 (see build.ts), only run the tests that go through the TypeScript facade.
// The others test TypeScript 6 APIs (emitDts, internal helpers) or don't use TypeScript.
if (process.env.SVELTE2TSX_TS === 'tsgo' || process.argv.includes('--tsgo')) {
    const facadeTests = ['htmlx2jsx', 'svelte2tsx', 'sourcemaps', 'span-map'];
    test_folders = test_folders.filter((folder) => facadeTests.includes(dirname(folder)));
    console.log(`Running ${test_folders.join(', ')} with TypeScript 7`);
}
const solo_folders = test_folders.filter(
    (folder) => glob('**/*.solo', { cwd: join('test', dirname(folder)) }).length
);

if (solo_folders.length) {
    solo_folders.forEach((name) => require('./' + name));
} else {
    test_folders.forEach((name) => require('./' + name));
}
