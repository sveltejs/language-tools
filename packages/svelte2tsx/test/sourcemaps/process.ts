import { ComposeHelper, compose_file } from './composer';
import {
    debug_print,
    each_exec,
    fromLineCharToOffset,
    get_extra_indent,
    hash,
    insert_segments,
    MappedKeys,
    MappedPosition,
    MappedRange,
    Mappings,
    Position,
    Range,
    range_for,
    reduce_segments,
    tab_aware_index,
    underline
} from './helpers';
import {
    GeneratedLine,
    GeneratedSourceText,
    Line,
    parse,
    ParsedSource,
    SourceText
} from './parser';

/**
 *
 * 	SourceMapping Tests
 *
 * 		- Original range (expected)		never changes
 * 		- Generated range (actual)		"always" changes
 *
 * 	Tested ranges cannot be stored as simple positions,
 * 	else they wouldn't map correctly on generated range change
 *
 * 	TestedRange format [number, number, string]
 *
 * 		[0] : index of the tested range in original
 * 		[1] : length in original
 * 		[2] : generated text for the range
 *
 * 	To find Tested Ranges between changes,
 *
 * 		1) Reverse lookup the generated position for [0]
 * 	 	2) Find the closest occurence of [2]
 *
 */
type RawTestRange = [ogStart: number, ogLength: number, genText: string];
type SourceMappingTest = { actual: Range; expected: Range; range: MappedRange };

// inject/retrieve info from raw file
namespace raw {
    // test.edit.jsx
    const EDIT_FILE_START = `/** Surround [[[text]]] with brackets & run tests to add it to this sample's tested ranges */\n`;
    const EDIT_FILE_END = `\n/** content-hash: $ */`.split('$'); // Hash of own content (used to check if ranges were edited)

    // test.jsx
    const TEST_FILE_START = '/** tested-ranges: $ */'.split('$'); // RawTestRange[] (what tests are evaluated from)
    const TEST_FILE_END = '\n/** origin-hash: $ */'.split('$'); // Hash of input.svelte

    /**
     * Return raw ranges and the hash from a test.jsx input string.
     */
    export function fromTestFile(file: string) {
        if (!file.startsWith(TEST_FILE_START[0]) || !file.includes(TEST_FILE_END[0]))
            throw new Error('Invalid test file');
        const length = TEST_FILE_START[0].length;
        const ranges = JSON.parse(file.slice(length, file.indexOf(TEST_FILE_START[1], length)));
        const hash = file.slice(
            file.lastIndexOf(TEST_FILE_END[0]) + TEST_FILE_END[0].length,
            -TEST_FILE_END[1].length
        );
        return { ranges: ranges as RawTestRange[], hash };
    }

    /**
     * Returns a string for a test.jsx file
     */
    export function toTestFile(origin: string, content: string, ranges: RawTestRange[]) {
        const raw = JSON.stringify(ranges);
        if (raw.includes(TEST_FILE_START[1]))
            throw new Error(`Tested range cannot include "${TEST_FILE_START[1]}"`);
        let header = TEST_FILE_START[0] + raw + TEST_FILE_START[1];
        if (ranges.length && /^\s*{\/\*\*/.test(content)) {
            const width = content.indexOf('{');
            content = content.slice(Math.min(width, header.length));
        }

        return header + content + TEST_FILE_END[0] + hash(origin) + TEST_FILE_END[1];
    }

    export function fromEditFile(file: string) {
        const start = file.lastIndexOf(EDIT_FILE_START);
        const end = file.lastIndexOf(EDIT_FILE_END[0]);
        if (start > 0) throw new Error('Test Edit file invalid start');
        if (end === -1) throw new Error('Test Edit file is missing its content-hash');
        return {
            content: file.slice(start === -1 ? 0 : EDIT_FILE_START.length, end),
            hash: file.slice(end + EDIT_FILE_END[0].length, file.indexOf(EDIT_FILE_END[1], end))
        };
    }

    export function toEditFile(content: string) {
        return EDIT_FILE_START + content + EDIT_FILE_END[0] + hash(content) + EDIT_FILE_END[1];
    }
}

namespace print {
    /**
     * Return string for mappings.jsx
     */
    export function mappings({ generated }: ParsedSource): string {
        return compose_file(function* (composer) {
            for (const line of generated.lines) {
                if (
                    line.index < generated.firstMapped ||
                    line.index > generated.lastMapped ||
                    line.isExact()
                ) {
                    yield line;
                } else {
                    yield composer.rule('', '-');
                    yield line;
                    yield composer.comment(comment_for(line), { indent: 0 });
                    yield composer.rule('', '-');
                }
            }
        });

        function* comment_for(line: GeneratedLine) {
            const text_generated = line.print();
            for (const { ogLine, text: text_og_subset, index } of line.subsets()) {
                const mapping_rel_generated = line.getGeneratedMappingResult(ogLine);
                const mapping_rel_original = line.getOriginalMappingResult(ogLine);
                const mapping_unordered = line.getOrderBreaking(ogLine);
                const text_original = ogLine.print();
                const show_gen_mapping =
                    mapping_rel_generated !== text_generated &&
                    mapping_rel_generated !== text_og_subset &&
                    mapping_rel_generated !== mapping_rel_original;

                let rest = '';
                const others = line.source.for(ogLine).filter((l) => l !== line);
                if (others.length !== 0) {
                    const lines = others.map((line) => line.index + 1).join(', ');
                    rest = `(rest generated at line${others.length === 1 ? '' : 's'} ${lines})`;
                }
                const offset = line.toString().match(/^\t*/)[0].length * 3;

                // prettier-ignore
                yield* [
					index !== 0								&& [``,								``												],
					index === 0 && !line.hasStartOrigin 	&& [line.getUnmappedStart(),		`Originless mappings`							],
					true 									&& [text_generated,					`[generated] line ${line.index + 1}`			],
					!line.isSingleOrigin 					&& [text_og_subset,					`[generated] subset`							],
					show_gen_mapping 						&& [mapping_rel_generated,			``												],
					!!mapping_unordered 					&& [mapping_unordered,				`Order-breaking mappings`						],
					mapping_rel_original !== text_original	&& [mapping_rel_original,			``												],
					true 									&& [text_original,					`[original] line ${ogLine.index + 1} ${rest}`	]
				].filter(Boolean).map(([map,comment])=>[" ".repeat(offset)+map,comment]) as [string, string][];
            }
        }
    }

    /**
     * Print string for test.jsx
     */
    export function test(test_ranges: RawTestRange[], source: ParsedSource): string {
        return raw.toTestFile(
            source.original.text,
            compose_file(compose_test, { match_first_column_width: true }),
            test_ranges
        );

        function* compose_test(composer: ComposeHelper) {
            const ranges = test_ranges.map((range) => tryEvalTestRange(range, source).range);
            for (let i = 0; i < ranges.length; i++) {
                yield composer.rule('', '-');
                if (is_same_line(ranges[i].start, ranges[i].end)) {
                    const j = i;
                    // print ranges that map from same gen line to same og line together
                    while (i < ranges.length - 1 && can_merge(ranges[i], ranges[i + 1])) i++;
                    const target = ranges.slice(j, i + 1);
                    const is_single = j === i;
                    for (const key of MappedKeys) {
                        const { line } = target[0].start[key];
                        if (!line) continue;
                        yield line;
                        yield composer.comment([
                            reduce_segments(
                                target.map((range) => range_for(key, range)),
                                (range, i) =>
                                    underline(
                                        tab_aware_index(line.toString(), range.start.character),
                                        tab_aware_index(line.toString(), range.end.character),
                                        (is_single ? '#' : i + 1) + '=='
                                    )
                            ).padEnd(line.length + get_extra_indent(line.toString()) - 3),
                            `[${key}] line ${line.index + 1}${
                                key === 'generated' && !target[0].start.original.line
                                    ? ' => No Mappings !'
                                    : ''
                            }`
                        ]);
                    }
                } else {
                    for (const key of MappedKeys) {
                        const p0 = ranges[i].start[key];
                        const p1 = ranges[i].end[key];

                        const lines = source[key].lines.slice(p0.line.index, p1.line.index + 1);

                        yield* lines;
                        const length = p1.line.start - p0.line.start + p1.character;
                        const full_underline = underline(p0.character, length, '#=#').toString();

                        yield composer.comment(
                            (function* (): Generator<[string, string]> {
                                let off = 0;
                                const r = lines.map<Range>((line: Line) => ({
                                    start: { line, character: 0 },
                                    end: { line, character: line.length - 1 }
                                }));
                                const l = r.length - 1;
                                r[0].start.character = p0.character;
                                r[l].end.character = p1.character;
                                for (let i = 0; i < lines.length; i++) {
                                    const line = lines[i];
                                    yield [
                                        ' '.repeat(off) + line.print(),
                                        `[${key}] line ${line.index + 1}`
                                    ];
                                    yield [full_underline.slice(off, off + line.length), ''];
                                    off += line.length;
                                }
                            })(),
                            { indent: 2 }
                        );
                    }
                }

                yield composer.rule('---');
            }
        }

        function can_merge(r1: MappedRange, r2: MappedRange) {
            return (
                is_same_line(r1.start, r2.end) &&
                r2.start.generated.character > r1.end.generated.character &&
                r2.start.original.character > r1.end.original.character
            );
        }

        function is_same_line(p1: MappedPosition, p2: MappedPosition) {
            return p1.generated.line === p2.generated.line && p1.original.line === p2.original.line;
        }
    }

    /**
     * Print string for test.edit.jsx
     */
    export function test_edit(parsed_tests: SourceMappingTest[], source: ParsedSource) {
        return raw.toEditFile(
            insert_segments(
                source.generated.text,
                (function* () {
                    for (const test of parsed_tests) {
                        const { start, end } = range_for('generated', test.range);
                        yield { start: fromLineCharToOffset(start), text: '[[[' };
                        yield { start: fromLineCharToOffset(end) + 1, text: ']]]' };
                    }
                })()
            )
        );
    }
}

function tryEvalTestRange(
    tested_range: RawTestRange,
    source: ParsedSource
): SourceMappingTest | null {
    const { generated, original } = source;
    const [ogStart, ogLength, genText] = tested_range;
    if (generated.text.includes(genText)) {
        const index = tryFindGenPosition(generated, genText, ogStart);
        const range = { start: generated.at(index), end: generated.at(index + genText.length - 1) };
        return {
            range,
            actual: range_for('original', range),
            expected: {
                start: original.toLineChar(ogStart),
                end: original.toLineChar(ogStart + ogLength - 1)
            }
        };
    }
}

function tryFindGenPosition(
    generated: GeneratedSourceText,
    generated_subset: string,
    ogStart: number
) {
    const matches = generated.from(ogStart);
    const { generated: cue } = matches.length === 1 ? matches[0] : tryPickMatch(matches);
    const forward = generated.text.indexOf(generated_subset, fromLineCharToOffset(cue));
    const backward = generated.text.lastIndexOf(generated_subset, fromLineCharToOffset(cue));
    const target = forward === backward || forward === -1 ? backward : forward;
    return target;

    function tryPickMatch(matches: MappedPosition[]) {
        const exact = matches.filter((match) =>
            match.generated.line.source.text
                .slice(fromLineCharToOffset(match.generated))
                .startsWith(generated_subset)
        );
        if (exact.length === 1) return exact[0];
        const l = exact.length;
        const m = matches.length;
        const m_of_them = l === m ? 'all of them' : l === 0 ? 'none' : `${l} out of ${m}`;
        throw new Error(
            `Could not find TestRange: Generated text includes ` +
                `${m} characters mapping back to origin's ${toString(matches[0].original)} and ` +
                `${m_of_them} start with the tested text "${generated_subset}"` +
                `\n Matching : ${matches.map((match) => toString(match.generated)).join(',\n')}`
        );
    }

    function toString(pos: Position) {
        return `[${pos.line.index + 1}:${pos.character + 1}]`;
    }
}

export function validate_edit_file(text_with_ranges: string) {
    for (const raw of parse_edit_ranges(text_with_ranges, false)) {
        if (raw.start === -1 || raw.end === -1) {
            const missing_start = raw.start === -1;
            const end = missing_start ? 'start' : 'end';
            const start = missing_start ? 'end' : 'start';
            const index = missing_start ? raw.end : raw.start;
            const { line, character } = new SourceText(text_with_ranges).toLineChar(index);
            throw new Error(
                `Line ${line.index + 1} ${start}s a range that has no corresponding ${end}\n\n` +
                    `\t${line.print()}\n` +
                    `\t${' '.repeat(character) + '^^^'}\n`
            );
        }
    }
}

export function validate_test_file(test: string) {
    raw.fromTestFile(test);
}

export function is_edit_changed(edit_file: string) {
    try {
        const { content, hash: prev } = raw.fromEditFile(edit_file);
        return hash(content) !== prev;
    } catch {
        return true;
    }
}

export function is_test_from_same_input(test: string, input: string) {
    return hash(input) === raw.fromTestFile(test).hash;
}

export function is_test_empty(test: string) {
    return raw.fromTestFile(test).ranges.length === 0;
}

export function is_edit_from_same_generated(test_edit: string, generated: string) {
    return raw.fromEditFile(test_edit).content.replace(/\[\[\[|\]\]\]/g, '') === generated;
}

export function is_edit_empty(test_edit: string) {
    return !/\[\[\[[^\]]*\]\]\]/.test(raw.fromEditFile(test_edit).content);
}

export function process_transformed_text(
    original_text: string,
    generated_text: string,
    mappings: Mappings
) {
    const source = parse(original_text, generated_text, mappings);
    return {
        print_mappings: () => print.mappings(source),

        generate_test_edit(test_file: string = '') {
            return print.test_edit(parse_test_file(test_file, source), source);
        },

        generate_test(test_edit_file: string = '') {
            if (test_edit_file) validate_edit_file(test_edit_file);
            return print.test(parse_edit_file(test_edit_file, source), source);
        },

        each_test_range(
            test_file: string,
            assertStrictEqual: (actual: string, expected: string) => void,
            invalid_file: () => void,
            invalid_range: (arr: RawTestRange[]) => void
        ) {
            const tested_ranges = parse_test_file(test_file, source, invalid_file, invalid_range);
            for (const { actual, expected, range } of tested_ranges) {
                const { start, end } = range_for('generated', range);
                let gen = '';
                if (start.line === end.line) {
                    gen += start.line.print() + '\n';
                    gen += underline(start.character, end.character);
                } else {
                    gen +=
                        source.generated.print_slice(
                            start.line.start,
                            end.line.start + end.line.length
                        ) + '\n';
                    gen += underline(start.character, end.line.start + end.character);
                }
                const og = source.original.print_slice(
                    Math.min(actual.start.line.start, expected.start.line.start),
                    Math.max(actual.end.line.end + 1, expected.start.line.end + 1)
                );
                assertStrictEqual(
                    gen + '\n' + og + '\n' + underline_offset(actual, expected),
                    gen + '\n' + og + '\n' + underline_offset(expected, actual)
                );
            }
        }
    };

    function underline_offset(r1: Range, r2: Range) {
        return underline(
            r1.start.character + (r1.start.line.start - r2.start.line.start),
            r1.end.character + (r1.end.line.start - r2.end.line.start),
            '#=='
        );
    }
}

function parse_test_file(
    test_file: string,
    source: ParsedSource,
    on_invalid_file?: () => void,
    on_invalid_range?: (ranges: RawTestRange[]) => void
) {
    const parsed: SourceMappingTest[] = [];
    const invalid: RawTestRange[] = [];
    const test_ranges = (function () {
        try {
            return raw.fromTestFile(test_file).ranges;
        } catch {
            return on_invalid_file?.(), [];
        }
    })();
    for (const test_range of test_ranges) {
        const range = tryEvalTestRange(test_range, source);
        if (range) parsed.push(range);
        else invalid.push(test_range);
    }
    if (invalid.length) on_invalid_range?.(invalid);
    return parsed;
}

function parse_edit_file(edit_file: string, { generated }: ParsedSource) {
    if (!edit_file) return [];
    return parse_edit_ranges(edit_file, true).map<RawTestRange>(function (raw) {
        const range = { start: generated.at(raw.start), end: generated.at(raw.end) };
        const original = range_for('original', range);
        const { start, end } = range_for('generated', range);
        const text = generated.text.slice(
            fromLineCharToOffset(start),
            fromLineCharToOffset(end) + 1
        );

        if (
            !original.start.line ||
            !original.end.line ||
            (original.start.line === original.end.line &&
                original.start.character === original.end.character &&
                !start.line.hasExactMappingFor(start.character))
        ) {
            throw new Error(
                `Failed to generate mapping test, selected range has no mappings.\n\n` +
                    debug_print(start, end)
            );
        }

        const ogStart = fromLineCharToOffset(original.start);
        const ogLength = fromLineCharToOffset(original.end) - ogStart + 1;
        return [ogStart, ogLength, text];
    });
}

function parse_edit_ranges(text_with_ranges: string, index_relative: boolean) {
    const ranges: { start: number; end: number }[] = [];
    const pending: { start: number; end: number }[] = [];
    const { content } = raw.fromEditFile(text_with_ranges);
    let offset = 0;
    for (const { match, index } of each_exec(content, /\[\[\[|\]\]\]/g)) {
        if (match === '[[[') {
            const range = { start: index - offset, end: -1 };
            pending.push(range);
            ranges.push(range);
        } else {
            if (pending.length === 0) {
                const range = { start: -1, end: -1 }; // error for later
                ranges.push(range);
                pending.push(range);
            }
            pending.pop().end = index - offset - 1;
        }
        if (index_relative) offset += 3;
    }
    return ranges;
}
