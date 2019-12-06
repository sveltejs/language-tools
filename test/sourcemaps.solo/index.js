let converter = require('../build/htmlxtojsx')
let fs = require('fs')
let assert = require('assert')
let sm = require('source-map')



describe('htmlx2jsx', () => {

	function extractLocations(input) {
		let lines = input.split("\n")
		let line
		let source = []
		let locations = new Map()
		while (line = lines.shift()) {
			//are we a range line, we test to see if it starts with whitespace followed by a digit
			if (/^\s*\d/.test(line)) {
				//create the ranges
				let currentId = null
				for (let char = 0; char < line.length; char++) {
					let c = line[char]
					let isDigit = /\d/.test(c), isEquals = /=/.test(c)
					if (isDigit) currentId = c
					if (isEquals || isDigit) {
						locations.set(`${source.length}:${char + 1}`, currentId)
					}
				}
			} else {
				//we are a source line
				source.push(line)
			}
		}

		return { source: source.join("\n") , locations }
	}


	fs.readdirSync(`${__dirname}`).forEach(dir => {
		if (dir[0] === '.') return;

		if (!dir.endsWith(".html") && !dir.endsWith(".html.solo")) return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo$/.test(dir);

		if (solo && process.env.CI) {
			throw new Error(
				`Forgot to remove '.solo' from test parser/samples/${dir}`
			);
		}

		(solo ? it.only : it)(dir, () => {
			const testContent = fs.readFileSync(`${__dirname}/${dir}`, 'utf-8').replace(/\s+$/, '').replace(/\r\n/g, "\n");

			let [inputBlock, expectedBlock] = testContent.split(/\n!Expected.*?\n/)

			let original = extractLocations(inputBlock);
			let expected = extractLocations(expectedBlock);

			const { map, code } = converter.htmlx2jsx(original.source);
			assert.equal(code, expected.source);

			let decoder = new sm.SourceMapConsumer(map);
			for (let [loc, id] of expected.locations.entries()) {
				let [ lineStr, colStr] = loc.split(":");
				let line = Number(lineStr), col = Number(colStr)
				let o = decoder.originalPositionFor({line: line, column: col});
				
			}

		});
	});
});