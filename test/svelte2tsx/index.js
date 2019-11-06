let converter = require('../../index.js')
let fs = require('fs')
let assert = require('assert')

describe('svelte2jsx', () => {
	fs.readdirSync(`${__dirname}/samples`).forEach(dir => {
		if (dir[0] === '.') return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo$/.test(dir);

		if (solo && process.env.CI) {
			throw new Error(
				`Forgot to remove '.solo' from test parser/samples/${dir}`
			);
		}

		(solo ? it.only : it)(dir, () => {
            const input = fs.readFileSync(`${__dirname}/samples/${dir}/input.svelte`, 'utf-8').replace(/\s+$/, '').replace(/\r\n/g, "\n");
            const expectedOutput = fs.readFileSync(`${__dirname}/samples/${dir}/expected.jsx`, 'utf-8').replace(/\s+$/, '').replace(/\r\n/g, "\n");

            const { map, code} = converter.svelte2jsx(input);
            assert.equal(code, expectedOutput);
		});
	});
});