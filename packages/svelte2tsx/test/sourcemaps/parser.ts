import {
    CharMap4,
    each_subset,
    GeneratedPosition,
    LineMap,
    MappedPosition,
    Mappings,
    print_string,
    reduce_segments,
    span,
    underline
} from './helpers';

type LineContext = { index: number; start: number; length: number };

export class SourceText<L extends Line = Line> {
    readonly lines: L[] = [];

    constructor(
        readonly text: string,
        line?: (ctx: LineContext) => L
    ) {
        this.lines = Array.from(
            (function* (text: string): Generator<LineContext> {
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
            })(text),
            line ? line.bind(this) : (ctx) => new Line(this, ctx)
        );
    }

    toLineChar(index: number) {
        let i = this.lines.length - 1;
        while (index < this.lines[i].start) i--;
        return { line: this.lines[i], character: index - this.lines[i].start };
    }

    print_slice(start: number, end?: number) {
        return print_string(this.text.slice(start, end));
    }
}

/**
 * Wrapper around text that was compiled from another
 */
export class GeneratedSourceText extends SourceText<GeneratedLine> {
    firstMapped: number;
    lastMapped: number;
    readonly original: SourceText;
    readonly mappings: Mappings;
    private readonly references: Map<Line, GeneratedLine[]>;

    constructor(text: string, original: SourceText, mappings: Mappings) {
        const references = new Map<Line, GeneratedLine[]>(original.lines.map((line) => [line, []]));
        super(text, function (this: GeneratedSourceText, line) {
            if (mappings.length > line.index && mappings[line.index].length > 0) {
                this.firstMapped ??= line.index;
                this.lastMapped = line.index;
                const lineMap = mappings[line.index];
                const genLine = new GeneratedLine(
                    this,
                    line,
                    lineMap,
                    [...new Set(lineMap.map((c) => c[2]))].sort().map((i) => original.lines[i])
                );
                for (const ogLine of genLine.ogLines) references.get(ogLine).push(genLine);
                return genLine;
            }
            return new GeneratedLine(this, line);
        });
        this.references = references;
        this.original = original;
        this.mappings = mappings;
    }

    at(genCharIndex: number): MappedPosition {
        const { line, character } = super.toLineChar(genCharIndex);
        return { generated: { line, character }, original: line.getOriginalPosition(character) };
    }

    from(ogCharIndex: number): MappedPosition[] {
        const original = this.original.toLineChar(ogCharIndex);
        const { line: ogLine, character: ogIndex } = original;
        const matches: GeneratedPosition[] = [];
        for (const line of this.for(ogLine)) {
            for (const char of line.lineMap) {
                if (char[2] === ogLine.index && char[3] === ogIndex) {
                    matches.push({ line, character: char[0] });
                }
            }
        }
        return matches.map((generated) => ({ generated, original }));
    }

    for(ogLine: Line) {
        return this.references.get(ogLine);
    }
}

/**
 * Wrapper around each line in a SourceText
 */
export class Line {
    readonly index: number;
    readonly start: number;
    readonly length: number;

    get end() {
        return this.start + this.length - 1;
    }

    constructor(
        readonly source: SourceText<any>,
        ctx: LineContext
    ) {
        ({ index: this.index, start: this.start, length: this.length } = ctx);
    }

    print_charAt(charIndex: number) {
        return print_string(this.source.text.charAt(this.start + charIndex));
    }

    print_slice(start: number, end?: number) {
        return print_string(
            start >= 0 && (end === undefined || (start <= end && end <= this.length))
                ? this.source.text.slice(this.start + start, this.start + (end ?? this.length))
                : this.toString().slice(start, end)
        );
    }

    print() {
        return this.print_slice(0);
    }

    toString() {
        return this.source.text.slice(this.start, this.start + this.length);
    }
}

/**
 * Wrapper around each line in a GeneratedSourceText
 */
export class GeneratedLine extends Line {
    readonly source: GeneratedSourceText;
    readonly hasOrigin = this.lineMap.length !== 0;
    readonly hasStartOrigin = this.hasOrigin && this.lineMap[0][0] === 0;
    readonly isSingleOrigin = this.hasOrigin && this.ogLines.length === 1;

    constructor(
        source: GeneratedSourceText,
        ctx: LineContext,
        readonly lineMap: LineMap = [],
        readonly ogLines: Line[] = []
    ) {
        super(source, ctx);
    }

    isExact() {
        return (
            this.hasOrigin &&
            this.hasStartOrigin &&
            this.isSingleOrigin &&
            this.ogLines[0].print() === this.print() &&
            this.source.for(this.ogLines[0]).length === 1 &&
            this.lineMap.every((char) => char[0] === char[3])
        );
    }

    getOrderBreaking(ogLine: Line) {
        let prev: CharMap4 = this.lineMap.find((char) => char[2] === ogLine.index);
        return reduce_segments(this.lineMap, function (char) {
            if (char[2] === ogLine.index) {
                if (prev[3] > char[3]) {
                    return underline(prev[0], (prev = char)[0] - 1, '#==');
                }
                prev = char;
            }
        });
    }

    getUnmappedStart() {
        return span(this.lineMap[0]?.[0] ?? this.length, '==#');
    }

    getGeneratedMappingResult(ogLine: Line) {
        return reduce_segments(this.lineMap, function (char) {
            if (char[2] === ogLine.index)
                return { start: char[0], text: ogLine.print_charAt(char[3]) };
        });
    }

    getOriginalMappingResult(ogLine: Line) {
        return reduce_segments(this.lineMap, function (char) {
            if (char[2] === ogLine.index)
                return { start: char[3], text: ogLine.print_charAt(char[3]) };
        });
    }

    *subsets() {
        if (!this.hasOrigin) return;
        if (this.isSingleOrigin)
            return yield {
                ogLine: this.ogLines[0],
                text: this.print_slice(this.lineMap[0][0]),
                index: 0
            };
        const text: { [ogLineIndex: number]: string } = {};
        for (const { line, start, end } of each_subset(this.lineMap))
            text[line] = (text[line] ?? '').padEnd(start) + this.print_slice(start, end);
        for (let index = 0; index < this.ogLines.length; index++) {
            const ogLine = this.ogLines[index];
            yield { ogLine, text: text[ogLine.index], index };
        }
    }

    getMappingFor(charIndex: number) {
        if (!this.hasOrigin || (!this.hasStartOrigin && charIndex < this.lineMap[0][0])) return;
        let i = this.lineMap.length - 1;
        while (this.lineMap[i][0] > charIndex) i--;
        return this.lineMap[i];
    }

    hasExactMappingFor(charIndex: number) {
        return this.getMappingFor(charIndex)?.[0] === charIndex;
    }

    getOriginalPosition(charIndex: number) {
        const char = this.getMappingFor(charIndex);
        if (!char) return { line: null, character: -1 };
        const { 2: line, 3: character } = char;
        return { line: this.source.original.lines[line], character };
    }
}

export type ParsedSource = {
    original: SourceText;
    generated: GeneratedSourceText;
};

/**
 * Reconciliates the generated text with the original using its mappings
 * @param original_text original code
 * @param generated_text transformed code compiled from original
 * @param mappings mappings from transformed to original
 */
export function parse(
    original_text: string,
    generated_text: string,
    mappings: Mappings
): ParsedSource {
    const original = new SourceText(original_text);
    return { original, generated: new GeneratedSourceText(generated_text, original, mappings) };
}
