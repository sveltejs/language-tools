import svelte2tsx from '../build/index';
import converter from '../build/htmlxtojsx';
import fs from 'fs';
import assert from 'assert';
import sm from 'source-map';

describe('sourcemap', () => {
    /**
     *
     * @param {string} input
     *
     * @returns { {source: string, locations: Map<String,{ line: number, start: number, offsets:number[] }}> }
     */
    function extractLocations(input) {
        let lines = input.split('\n');
        let line;
        let source_line = 0;
        let source = [];
        let locations = new Map();
        while (lines.length) {
            line = lines.shift();
            //are we a range line, we test to see if it starts with whitespace followed by a digit
            if (/^\s*[\d=]+[\s\d=]*$/.test(line)) {
                //create the ranges
                let currentId = null;
                let offset = 0;
                let offsets = [];
                let start = 0;
                const endSpan = () => {
                    if (offsets.length) {
                        locations.set(currentId, {
                            line: source_line,
                            start: start,
                            offsets: offsets
                        });
                    }
                    offset = 0;
                    offsets = [];
                };

                for (let char = 0; char < line.length; char++) {
                    let c = line[char];
                    let isDigit = /\d/.test(c),
                        isEquals = /=/.test(c);
                    if (isDigit) {
                        endSpan();
                        currentId = c;
                        start = char + 1;
                    }
                    if (isEquals || isDigit) {
                        offsets.push(offset);
                        offset++;
                    } else {
                        endSpan();
                    }
                }
                endSpan();
            } else {
                //we are a source line
                source.push(line);
                source_line++;
            }
        }

        return { source: source.join('\n'), locations };
    }

    fs.readdirSync(`${__dirname}`).forEach((dir) => {
        if (dir[0] === '.') return;

        if (!dir.endsWith('.html') && !dir.endsWith('.html.solo')) return;

        // add .solo to a sample directory name to only run that test
        const solo = /\.solo$/.test(dir);

        if (solo && process.env.CI) {
            throw new Error(`Forgot to remove '.solo' from test parser/samples/${dir}`);
        }

        let showWhitespace = (str) => {
            return str.replace(/\t/g, '\\t').replace(/\n/g, '\\n\n').replace(/\r/g, '\\r');
        };

        (solo ? it.only : it)(dir, () => {
            const testContent = fs
                .readFileSync(`${__dirname}/${dir}`, 'utf-8')
                .replace(/\r\n/g, '\n')
                .replace(/\t/g, '    ');

            let [inputBlock, expectedBlock] = testContent.split(/\n!Expected.*?\n/);
            let input = extractLocations(inputBlock);
            let expected = extractLocations(expectedBlock);

            // seems backwards but we don't have an "input" source map, so we generate one from our expected output
            // but assert that the source it generates matches our input source.
            //console.log(expected.source)
            const { map, code } = dir.endsWith('.htmlx.html')
                ? converter.htmlx2jsx(expected.source)
                : svelte2tsx(expected.source);
            assert.equal(
                showWhitespace(code),
                showWhitespace(input.source),
                "Couldn't generate input source map for test"
            );

            let decoder = new sm.SourceMapConsumer(map);

            for (let [id, span] of input.locations.entries()) {
                let expectedSpan = expected.locations.get(id);

                //walk our generated span checking it lines up
                let col = span.start;
                let input_line = span.line;
                let expected_line = expectedSpan.line;

                assert.ok(input.source);
                let error_source = input.source.split('\n')[span.line - 1];
                assert.ok(error_source);
                let error_map = new Array(error_source.length).fill(' ');

                let actual_result_line, actual_result_source, actual_result;
                let errorCount = 0;

                for (var off = 0; off < span.offsets.length; off++) {
                    let input_col = col + off;
                    let expected_col = expectedSpan.start + span.offsets[off];

                    //originalPositionFor uses 0 base cols and 1 base lines....
                    let { line: actual_line, column: decoded_col } = decoder.originalPositionFor({
                        line: input_line,
                        column: input_col - 1
                    });
                    let actual_col = decoded_col + 1;

                    if (!actual_result) {
                        actual_result_source = expected.source.split('\n')[actual_line - 1];
                        actual_result = new Array(actual_result_source.length).fill(' ');
                        actual_result_line = actual_line;
                    }
                    if (actual_line == actual_result_line) {
                        if (actual_result_line[actual_col - 1] == ' ') {
                            actual_result[actual_col - 1] = '1';
                        } else {
                            //track number of characters mapped to result
                            actual_result[actual_col - 1] = `${Math.min(
                                (actual_result[actual_col - 1] << 0) + 1,
                                9
                            )}`;
                        }
                    } else {
                        actual_result = actual_result + 'X';
                    }

                    if (actual_col != expected_col || actual_line != expected_line) {
                        errorCount++;
                        error_map[input_col - 1] = 'X';
                    } else {
                        error_map[input_col - 1] = '=';
                    }
                }

                if (errorCount != 0) {
                    assert.fail(`
					Errors on span ${id}
			
					Output
					${actual_result_source}
					${actual_result.join('').replace(/1/g, '=')}

					Errors
					${error_source}
					${error_map.join('')}
					`);
                }
            }
        });
    });
});
