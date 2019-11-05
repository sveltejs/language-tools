const glob = require('tiny-glob/sync.js');

require('source-map-support').install();


require('./helpers');

//console.clear();

const test_folders = glob('*/index.js', { cwd: 'test' });
const solo_folders = test_folders.filter(folder => /\.solo/.test(folder));

if (solo_folders.length) {
	if (process.env.CI) {
		throw new Error('Forgot to remove `.solo` from test');
	}
	solo_folders.forEach(name => require('./' + name));
} else {
	test_folders.forEach(name => require('./' + name));
}