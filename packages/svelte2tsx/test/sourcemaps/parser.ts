import assert from 'assert';
import { binarySearch } from '../helpers';
type HiResCharMap = [
    generated_charIndex: number,
    original_fileIndex: number,
    original_lineIndex: number,
    original_charIndex: number
];
type HiresLineMap = HiResCharMap[];
type HiresMappings = HiresLineMap[];
type LineContext = { index: number; start: number; length: number };
function* each_line(text: string): Generator<LineContext> {
    const line = { index: 0, start: 0, length: 0 };
    for (let i = 0; i < text.length; i++)
        switch (text.charCodeAt(i)) {
            case 13: // "\r"
                if (10 === text.charCodeAt(i + 1)) i++;
            case 10: // "\n"
                line.length = 1 + i - line.start;
                yield line;
                line.start += line.length;
                line.index++;
        }
    if (line.start === text.length) return;
    line.length = text.length - line.start;
    yield line;
}
class SourceText {
    constructor(readonly text: string) {
        if (this.constructor === SourceText) {
            this.lines = Array.from(each_line(this.text), (line) => new Line(this, line));
        }
    }
    readonly lines: readonly Line[];
}
class GeneratedSourceText extends SourceText {
    constructor(text: string, readonly original: SourceText, readonly mappings: HiresMappings) {
        super(text);
        this.lines = Array.from(each_line(this.text), (line) => new GeneratedLine(this, line));
    }
    readonly lines: readonly GeneratedLine[];
    lastUnmappedLine() {
        let i = 0;
        for (const line of this.mappings) {
            if (line.length !== 0) {
                if (i === 0) return;
                else return this.lines[i - 1];
            } else i++;
        }
    }
    lastMappedLine() {
        let i = this.mappings.length - 1;
        while (this.lines[i].lineMap.length === 0) i--;
        return this.lines[i];
    }
    findLine(lineContent: string) {
        const text = untab(lineContent);
        return this.lines.filter((line) => untab(line.content) === text);
    }
}
class Line {
    readonly length: number;
    readonly index: number;
    readonly start: number;
    constructor(
        readonly source: SourceText, //
        ctx: LineContext
    ) {
        this.index = ctx.index;
        this.start = ctx.start;
        this.length = ctx.length;
    }
    get content() {
        return this.source.text.slice(this.start, this.start + this.length);
    }
}
class GeneratedLine extends Line {
    readonly source: GeneratedSourceText;
    readonly lineMap: HiresLineMap = this.source.mappings[this.index] ?? [];
    readonly ogLines = [
        ...new Set(this.lineMap.map((char) => this.source.original.lines[char[2]]))
    ].sort((a, b) => (a.index > b.index ? 1 : -1));
    readonly firstOgLine = this.ogLines[0];
    hasNoOrigin() {
        return 0 === this.lineMap.length;
    }
    hasNoStartOrigin() {
        return 0 !== this.lineMap[0]?.[0];
    }
    isExact() {
        if (!this.isExactlyOneLine()) return false;
        if (this.firstOgLine.content !== this.content) return false;
        for (const { 0: genIndex, 3: ogIndex } of this.lineMap) {
            if (genIndex !== ogIndex) return false;
        }
        return true;
    }
    isSingleOrigin() {
        return this.ogLines.length === 1;
    }
    isExactlyOneLine() {
        return (
            this.isSingleOrigin() &&
            this.lineMap.length === this.length &&
            this.firstOgLine.length === this.length &&
            this.isOwnOriginalLine(this.firstOgLine)
        );
    }
    getOtherLinesReferencing(ogLine: Line) {
        return this.source.lines.filter((line) => line !== this && line.ogLines.includes(ogLine));
    }
    isOwnOriginalLine(ogLine: Line) {
        for (const line of this.source.lines) {
            if (line === this) continue;
            for (const _ogLine of line.ogLines) {
                if (_ogLine === ogLine) return false;
            }
        }
        return true;
    }
    private reduce(
        fn: (
            prev: HiResCharMap,
            char: HiResCharMap,
            write: (index: number, replacement: string, format?: boolean) => void
        ) => void
    ) {
        let str = '';
        function write(index: number, replacement: string, format: boolean = true) {
            str = overwrite(str, index, format ? print_string(replacement) : replacement);
        }
        let prev: HiResCharMap;
        for (const char of this.lineMap) {
            fn(prev, char, write);
            prev = char;
        }
        fn(prev, undefined, write);
        return str;
    }
    getGeneratedUnordered(ogLine: Line) {
        let _prev;
        const str = this.reduce((prev, char, write) => {
            if (char && char[2] === ogLine.index) {
                if (_prev && _prev[3] > char[3]) {
                    write(_prev[0], '#' + '='.repeat(char[0] - _prev[0] - '#'.length));
                }
                _prev = char;
            }
        });
        if (isntempty(str)) return str;
        return '';
    }
    getGeneratedSplit() {
        if (this.isSingleOrigin())
            return [{ line: this.firstOgLine, text: print_string(this.content) }];
        const arr: { line: Line; text: string }[] = [];
        let current: { line: Line; text: string };
        let prev: HiResCharMap = [0] as any;
        for (const char of this.lineMap) {
            if (current)
                current.text = overwrite(
                    current.text,
                    prev[0],
                    print_string(this.content.slice(prev[0], char[0]))
                );
            if (char[2] !== current?.line.index) {
                const p = arr.find((v) => v.line.index === char[2]);
                if (p) current = p;
                else
                    arr.push(
                        (current = {
                            line: this.source.original.lines[char[2]],
                            text: ' '.repeat(char[0])
                        })
                    );
            }
            prev = char;
        }
        if (current)
            current.text = overwrite(
                current.text,
                prev[0],
                print_string(this.content.slice(prev[0]))
            );
        return arr.sort((a, b) => (a.line.index > b.line.index ? 1 : -1));
    }
    getGeneratedMappingResult(ogLine: Line) {
        return this.reduce((prev, char, write) => {
            if (char && char[2] === ogLine.index) {
                write(char[0], ogLine.content[char[3]]);
            }
        });
    }
    getOriginalMappingResult(ogLine: Line) {
        return this.reduce((prev, char, write) => {
            if (char && char[2] === ogLine.index) {
                write(char[3], ogLine.content[char[3]]);
            }
        });
    }
    getOriginalPosition(charIndex: number) {
        const closestMatch = binarySearch(this.lineMap, charIndex, '0');
        if (closestMatch === -1) return { line: null, character: -1 };
        const { 2: line, 3: character } = this.lineMap[closestMatch];
        return { line: this.source.original.lines[line], character };
    }
}
function isntempty(str: string) {
    return str.replace(/\s/g, '') !== '';
}
type TPrint = [string, string, Line?][];
export function print_mappings(
    original_text: string,
    generated_text: string,
    mappings: HiresMappings
) {
    const original = new SourceText(original_text);
    const generated = new GeneratedSourceText(generated_text, original, mappings);
    const writer = new CommentWriter(1 + Math.max(...generated.lines.map((line) => line.length)));
    const lastUnmapped = generated.lastUnmappedLine();
    const lastMapped = generated.lastMappedLine();
    let started = lastUnmapped === undefined;
    let ended = false;
    for (const line of generated.lines) {
        if (!started) {
            if (lastUnmapped === line) {
                started = true;
            }
            writer.raw(line.content);
            continue;
        }
        if (ended || (line !== lastMapped && line.isExact())) {
            writer.raw(line.content);
            continue;
        }
        if (line === lastMapped) {
            ended = true;
        }

        writer.for(line.content, function (writeLine) {
            const print: TPrint = [];
            const is_single_origin = line.isSingleOrigin();
            const generated_text = print_string(line.content);

            if (line.hasNoStartOrigin()) {
                const index = line.hasNoOrigin() ? line.content.length : line.lineMap[0][0];
                print.push(['☼'.repeat(index), `Originless characters`]);
            }

            for (const { line: ogLine, text: own_subset } of line.getGeneratedSplit()) {
                const original_text = print_string(ogLine.content);

                if (!is_single_origin && ogLine !== line.firstOgLine) print.push(['', '']);

                print.push([generated_text, `[generated] line ${line.index + 1}`]);

                if (!is_single_origin) print.push([own_subset, `[generated] subset`]);

                const generated_mapping = line.getGeneratedMappingResult(ogLine);

                if (
                    original_text !== generated_mapping &&
                    generated_text !== generated_mapping &&
                    own_subset !== generated_mapping
                )
                    print.push([generated_mapping, '']);

                const unordered = line.getGeneratedUnordered(ogLine);
                if (unordered) print.push([unordered, `Order-breaking mappings`]);

                const original_mapping = line.getOriginalMappingResult(ogLine);
                if (generated_mapping !== original_mapping && original_text !== original_mapping) {
                    print.push([original_mapping, ``]);
                }

                let og_comment = `[original] line ${ogLine.index + 1}`;
                if (!line.isOwnOriginalLine(ogLine)) {
                    const others = line.getOtherLinesReferencing(ogLine);
                    const i = others.map((line) => line.index + 1).join(', ');
                    og_comment += ` (rest generated at line${others.length === 1 ? '' : 's'} ${i})`;
                }

                print.push([original_text, og_comment]);
            }
            const width = 1 + Math.max(...print.map((v) => v[0].length));
            writeLine(`# Line ${line.index + 1} #`, '-');
            for (const [content, name] of print) {
                writeLine(content.padEnd(width) + '\t' + name);
            }
            writeLine('', '-');
        });
    }
    return writer.toString();
}
function print_string(str: string) {
    return str
        .replace(/ /g, '•')
        .replace(/[\r\n]/g, '↲')
        .replace(/\t/g, '╚');
}
function overwrite(str: string, start: number, replacement: string) {
    if (str.length < start) return str.padEnd(start, ' ') + replacement;
    return str.slice(0, start) + replacement + str.slice(start + replacement.length);
}
function ensureLN(str: string) {
    if (!/\n\s*$/.test(str)) return str + '\n';
    return str;
}
function untab(str: string) {
    return str.replace(/\t/g, '    ');
}
class CommentWriter {
    constructor(readonly width: number = 150) {}
    private str: string = '';
    private concat(str: string) {
        this.str += ensureLN(str);
    }
    raw(str: string) {
        this.concat(str);
    }
    for(generatedLine: string, fn: (writeLine: (str: string, fill?: string) => void) => void) {
        const inline = generatedLine.includes('//');
        const initial = generatedLine.replace(/\t/g, '    ');
        let str = initial;
        let lastLine = '';

        if (inline) {
            if (!str.startsWith('///')) str = '  ' + str;
        } else str = str.padEnd(this.width).replace(/(\r?\n)(\s*)$/, `$2 {/** $1`);

        fn((line, fill) => {
            if (inline) str += '//';
            if (fill) {
                const length = this.width - +inline * 2;
                line = line.padStart((length + line.length) >> 1, fill).padEnd(length, fill);
            } else if (!inline) {
                str += '\t\t';
            }
            str += (lastLine = line) + '\n';
        });

        if (inline) {
        } else {
            const i = Math.max(0, this.width - lastLine.length);
            str = (str + ' '.repeat(i)).replace(/(\r?\n)(\s*)$/, `$2 */} $1`);
        }
        if (!lastLine) this.concat(initial);
        else this.concat(str);
    }
    toString() {
        return this.str;
    }
}

export function test_sample_result(
    original_text: string,
    generated_text: string,
    html_text: string,
    mappings: HiresMappings
) {
    assert.ok(html_text);

    const original = new SourceText(original_text);
    const generated = new GeneratedSourceText(generated_text, original, mappings);
    const tested = new SourceText(html_text);

    let i = 0;
    while (i < tested.lines.length) {
        const [svelte_line, svelte_range, tsx_line, tsx_range] = tested.lines.slice(i, (i += 4));
        assert_includes(original_text, svelte_line, svelte_range);
        assert_includes(generated_text, tsx_line, tsx_range);
        const [match] = generated.findLine(tsx_line.content);
        let actual_range = '';
        let ogLine: Line;
        for (const range of each_range(tsx_range)) {
            const start = match.getOriginalPosition(range.start);
            const end = match.getOriginalPosition(range.end);
            range_line_exists(start, i, range, tsx_line);
            range_line_exists(end, i, range, tsx_line);
            assert.ok(end.line);
            assert.ok(start.line === end.line);
            if (ogLine) assert.ok(ogLine === start.line);
            else ogLine = start.line;
            const { line } = start;
            const r = untab(line.content);
            assert.strictEqual(
                untab(svelte_line.content).replace(/\s*$/, ''),
                r.replace(/\s*$/, '')
            );
            const length = Math.max(0, end.character - start.character);
            actual_range = overwrite(
                actual_range,
                start.character,
                `${range.n}${'='.repeat(length)}`
            );
        }
        assert.strictEqual(
            untab(ogLine.content).replace(/\s*$/, '\n') + `${untab(actual_range)}`,
            untab(svelte_line.content).replace(/\s*$/, '\n') +
                `${untab(svelte_range.content).replace(/[\s]*$/, '')}`
        );
    }
}
function range_line_exists(
    start: { line: Line; character: number },
    i: number,
    range: { n: string; start: number; end: number },
    tsx_line: Line
) {
    assert.ok(
        start.line,
        `Range ${Math.floor(i / 4)}-${range.n} "${untab(tsx_line.content).slice(
            range.start,
            range.end
        )}" doesn't map to anything`
    );
}

function* each_range(line: Line) {
    const text = untab(line.content);
    const re = /([0-9])=*/g;
    let match: RegExpExecArray;
    while ((match = re.exec(text))) {
        // ["1===", "1"]
        yield {
            n: match[1],
            start: match.index,
            end: match.index + match[0].length - 1
        };
    }
}
function assert_includes(original_text: string, line: Line, range: Line) {
    assert.ok(line);
    assert.ok(range);
    const index = original_text.indexOf(line.content.replace(/\s*$/, ''));
    assert.ok(
        index !== -1,
        `Could not find tested line in sample\n\n${line.content}\n` + original_text
    );
    assert.ok(
        original_text.lastIndexOf(line.content.replace(/\s*$/, '')) === index,
        `Found several occurences of "${line.content}" in sample`
    );
    assert.ok(isntempty(range.content));
    assert.ok(
        /^(\s*[0-9]=*\s*)+$/.test(untab(range.content)),
        `"${range.content}" includes invalid range characters`
    );
}
