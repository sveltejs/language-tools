let svelte2tsx = require('../build/index')
let fs = require('fs')
let assert = require('assert')

describe('svelte2tsx', () => {
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
			const path = `${__dirname}/samples/${dir}`;
            const input = fs.readFileSync(`${path}/input.svelte`, 'utf-8').replace(/\s+$/, '').replace(/\r\n/g, "\n");
			const expectedOutput = fs.readFileSync(`${path}/expected.tsx`, 'utf-8').replace(/\s+$/, '').replace(/\r\n/g, "\n");
			const expecterOtherOutput = fs.existsSync(`${path}/expected.js`) && require(`${path}/expected`);

            const output = svelte2tsx(input, {
				strictMode: dir.includes('strictMode'),
				isTsFile: dir.startsWith('ts-'),
				filename: 'input.svelte'
			});
			assert.equal(output.code, expectedOutput);
			if (expecterOtherOutput) {
				expecterOtherOutput(output);
			}
		});
	});
});
