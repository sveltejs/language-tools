import { GeneratedLine, Line } from './parser';

export type CharMap4 = [
    generated_charIndex: number,
    original_fileIndex: number,
    original_lineIndex: number,
    original_charIndex: number
];

export type LineMap = CharMap4[];
export type Mappings = LineMap[];
export type Segment = { start: number; text: string };
export type Range = { start: Position; end: Position };
export type MappedPosition = { generated: GeneratedPosition; original: Position };
export type MappedRange = { start: MappedPosition; end: MappedPosition };
export const MappedKeys: (keyof MappedPosition)[] = ['generated', 'original'];

export interface Position {
    line: Line;
    character: number;
}
export interface GeneratedPosition extends Position {
    line: GeneratedLine;
}

export function print_string(str: string) {
    return ('' + str)
        .replace(/ /g, '•')
        .replace(/[\r\n]/g, '↲')
        .replace(/\t/g, '╚');
}

function edit(str: string, { start, text }: Segment, insert: boolean) {
    if (str.length === start) return str + text;
    else if (str.length < start) return str.padEnd(start) + text;
    else return str.slice(0, start) + text + str.slice(start + (insert ? 0 : text.length));
}

export function reduce_segments<T>(
    gen: Iterable<T>,
    fn: (value: T, index: number) => Segment | void,
    initial = ''
) {
    let str = initial;
    let i = 0;
    for (const value of gen) {
        const segment = fn(value, i++);
        if (segment) str = edit(str, segment, false);
    }
    return str;
}

export function insert_segments(text: string, segments: Iterable<Segment>) {
    let str = '';
    let prev_start: number = undefined;
    for (const segment of [...segments].sort((a, b) => b.start - a.start)) {
        str = segment.text + text.slice(segment.start, prev_start) + str;
        prev_start = segment.start;
    }
    return text.slice(0, prev_start) + str;
}

export function fromLineChar({ line, character }: { line: Line; character: number }) {
    return line.start + character;
}

export function span(length: number, [head, body, tail]: string = '#==') {
    if (length <= 1) return length < 1 ? '' : body === tail ? head : tail;
    return head + body.repeat(length - 2) + tail;
}

class Underline {
    constructor(readonly start: number, readonly text: string) {}
    toString() {
        return ' '.repeat(this.start) + this.text;
    }
}

export function underline(start: number, end: number, style?: string) {
    return new Underline(start, span(end - start + 1, style));
}

export function* each_subset(lineMap: LineMap) {
    let char = lineMap[0];
    for (let i = 1; i < lineMap.length; i++) {
        if (char[2] !== lineMap[i][2]) {
            yield { line: char[2], start: char[0], end: (char = lineMap[i])[0] };
        }
    }
    yield { line: char[2], start: char[0], end: undefined };
}

export function* each_exec(str: string, re: RegExp) {
    let arr: RegExpExecArray;
    while ((arr = re.exec(str))) yield { match: arr[0], index: arr.index };
}

export function tab_aware_index(str: string, index: number) {
    return index + get_extra_indent(str.slice(0, index + 1));
}

export function get_extra_indent(str: string) {
    return (str.match(/\t/g)?.length ?? 0) * 3;
}

export function range_for<K extends keyof MappedPosition>(key: K, range: MappedRange) {
    return { start: range.start[key], end: range.end[key] };
}

export function hash(str: string): string {
    str = str.replace(/\r/g, '');
    let hash = 5381;
    let i = str.length;
    while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return (hash >>> 0).toString(36);
}
