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

const test_folders = glob('*/index.ts', { cwd: 'test' });
const solo_folders = test_folders.filter(
    (folder) => glob('**/*.solo', { cwd: join('test', dirname(folder)) }).length
);

if (solo_folders.length) {
    solo_folders.forEach((name) => require('./' + name));
} else {
    test_folders.forEach((name) => require('./' + name));
}
