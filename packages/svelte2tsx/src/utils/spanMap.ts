import MagicString, { SourceMap, SourceMapSegment } from 'magic-string';
import { IGNORE_END_COMMENT, IGNORE_START_COMMENT } from './ignore';

const GENERATE_LENGTH = 1;
const ORIGINAL_LENGTH = 3;
const FEATURES_FLAGS = 5;

/**
 * Generates TypeScript 7's span map and diagnostic directives for the svelte2tsx output.
 *
 * - The base are the `Verbatim` runs (and 1-character atoms for edited chunks) derived from
 *   MagicString's mappings (`getHiresSegments`). Hints keyed by original offset (`addSourceSpan`,
 *   `ignoreMappingForPosition`) adjust them. That's fine for original text, which appears once.
 * - Generated code gets explicit segments where it's created: `mapGenerated` wraps it in marker
 *   comments with an id into a side table. The markers travel with the text through all `str.move`s
 *   and are read and stripped from the final text, so positions are exact. Explicit segments win
 *   over derived ones inside their range.
 * - Every `/*Ωignore_startΩ*\/…/*Ωignore_endΩ*\/` region becomes an `Ignore` directive over its
 *   final virtual range, except for the parts wrapped with `keepDiagnostics`.
 */
export class SpanMapGenerator {
    private spans: Span[] = [];
    private ignoreMappings = new Set<number>();
    private annotations: Annotation[] = [];
    private readonly markerPrefix: string;
    private readonly markerRegex: RegExp;

    constructor(original: string) {
        // Markers are stripped from the output; make sure user code can't contain one
        let prefix = 'Ω#';
        while (original.includes('/*' + prefix)) {
            prefix = 'Ω' + prefix;
        }
        this.markerPrefix = prefix;
        this.markerRegex = new RegExp(`/\\*${prefix}(\\d+)Ω\\*/`, 'g');
    }

    /**
     * Add an identifier or literal span to the list of spans to be mapped.
     * The span is defined by its start and end positions in the original source code.
     */
    addSourceSpan(start: number, end: number, options?: { features?: SpanMapFeature }) {
        this.spans.push({ start, end, features: options?.features });
    }

    ignoreMappingForPosition(start: number) {
        this.ignoreMappings.add(start);
    }

    /**
     * Returns `text` (generated code) marked so that it maps to `original`. With the default
     * `features: None`, the segment is invisible to all language features, but places the
     * diagnostics of `text` at `original` instead of reporting them as unmapped.
     */
    mapGenerated(
        text: string,
        [originalStart, originalEnd]: [number, number],
        features = SpanMapFeature.None
    ): string {
        return this.mark(text, {
            type: 'segment',
            originalStart,
            originalEnd,
            features
        });
    }

    /**
     * Returns `text` marked so that the `Ignore` directive of a surrounding ignore region doesn't
     * apply to it: its diagnostics stay unmapped, for the post-processing of the language server.
     */
    keepDiagnostics(text: string): string {
        return this.mark(text, { type: 'keepDiagnostics' });
    }

    private mark(text: string, annotation: Annotation): string {
        const id = this.annotations.push(annotation) - 1;
        const marker = `/*${this.markerPrefix}${id}Ω*/`;
        return marker + text + marker;
    }

    /**
     * Reads the markers from the final text, strips them, and returns the text, its span map and
     * its diagnostic directives
     */
    generate(str: MagicString): SpanMapOutput {
        const marked = str.toString();
        const markers = this.readMarkers(marked);
        const shift = new PositionShift(markers.removed);
        const code = shift.apply(marked);

        const mappings: SpanMapping[] = [];
        for (const mapping of overlay(this.deriveMappings(str, marked), markers.segments)) {
            const start = shift.map(mapping[0]);
            const length = shift.map(mapping[0] + mapping[1]) - start;
            if (length > 0) {
                mapping[0] = start;
                mapping[GENERATE_LENGTH] = length;
                mappings.push(mapping);
            }
        }

        const directives = createIgnoreDirectives(
            code,
            markers.keep.map(([start, end]) => [shift.map(start), shift.map(end)]),
            mappings
        );
        const checked = checkSpanMap(str.original, code, mappings, directives);

        return {
            code,
            mappings: checked.mappings,
            diagnosticDirectives: checked.directives.length
                ? { unusedExpectDirectiveDiagnostics: [], directives: checked.directives }
                : undefined,
            issues: checked.issues.length ? checked.issues : undefined,
            generateMap(options) {
                const map = str.generateDecodedMap(options);
                if (markers.removed.length) {
                    map.mappings = shift.applyToDecodedMappings(map.mappings, marked, code);
                }
                return new SourceMap(map);
            }
        };
    }

    private readMarkers(marked: string) {
        const removed: Range[] = [];
        const segments: SpanMapping[] = [];
        const keep: Range[] = [];
        const open = new Map<number, number>();

        this.markerRegex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = this.markerRegex.exec(marked))) {
            const id = Number(match[1]);
            const annotation = this.annotations[id];
            if (!annotation) {
                continue;
            }
            const start = match.index;
            const end = start + match[0].length;
            removed.push([start, end]);

            // start and end marker; the same marked text may occur more than once
            const textStart = open.get(id);
            if (textStart === undefined) {
                open.set(id, end);
                continue;
            }
            open.delete(id);
            if (textStart === start) {
                continue;
            }
            if (annotation.type === 'segment') {
                segments.push([
                    textStart,
                    start - textStart,
                    annotation.originalStart,
                    annotation.originalEnd - annotation.originalStart,
                    SpanMapKind.Atom,
                    annotation.features
                ]);
            } else {
                keep.push([textStart, start]);
            }
        }
        return { removed, segments, keep };
    }

    /**
     * Derives the span map from MagicString's (hires) source map segments: runs of identical
     * characters become `Verbatim`, the first character of each edited chunk a 1-character `Atom`
     */
    private deriveMappings(str: MagicString, generatedCode: string): SpanMapping[] {
        const mappings: SpanMapping[] = [];
        const { generated, original } = getHiresSegments(str);
        const sourceSpanMap = new Map<number, Span>();
        for (const span of this.spans) {
            sourceSpanMap.set(span.start, span);
        }

        let current: SpanMapping | undefined;
        for (let segmentIndex = 0; segmentIndex < generated.length; segmentIndex++) {
            const originalStart = original[segmentIndex];
            const generatedStart = generated[segmentIndex];
            if (this.ignoreMappings.has(originalStart)) {
                continue;
            }
            const sourceSpan = sourceSpanMap.get(originalStart);

            const sourceChar = str.original.charCodeAt(originalStart);
            const sameChar = generatedCode.charCodeAt(generatedStart) === sourceChar;

            if (sourceSpan && !sameChar) {
                // An edited first character with something prepended (`"on:click`): the
                // prepended text becomes an atom, the rest of the span stays verbatim
                if (segmentIndex + 1 < generated.length) {
                    const nextOriginalStart = original[segmentIndex + 1];
                    const nextGeneratedStart = generated[segmentIndex + 1];
                    if (
                        nextOriginalStart === originalStart + 1 &&
                        generatedCode.charCodeAt(nextGeneratedStart - 1) === sourceChar &&
                        generatedCode.charCodeAt(nextGeneratedStart) ===
                            str.original.charCodeAt(nextOriginalStart)
                    ) {
                        const prependLength = nextGeneratedStart - generatedStart - 1;
                        if (prependLength > 0) {
                            mappings.push([
                                generatedStart,
                                prependLength,
                                originalStart,
                                0,
                                SpanMapKind.Atom
                            ]);
                        }
                        current = [
                            nextGeneratedStart - 1,
                            2,
                            originalStart,
                            2,
                            SpanMapKind.Verbatim
                        ];
                        addFlag(current, sourceSpan.features);
                        segmentIndex++;
                        mappings.push(current);
                        continue;
                    }
                }
            }

            if (
                current &&
                sameChar &&
                segmentIndex > 0 &&
                originalStart === original[segmentIndex - 1] + 1 &&
                generatedStart === generated[segmentIndex - 1] + 1
            ) {
                current[GENERATE_LENGTH]++;
                current[ORIGINAL_LENGTH]++;
                continue;
            }

            current = [
                generatedStart,
                1,
                originalStart,
                1,
                sameChar ? SpanMapKind.Verbatim : SpanMapKind.Atom
            ];
            addFlag(current, sourceSpan?.features);
            mappings.push(current);
        }

        return mappings;
    }
}

/**
 * The segments of MagicString's `hires` source map as offsets, without computing the map: per
 * character (line breaks included) for unedited chunks, at the start and at each further line
 * start for edited ones. Uses
 * MagicString's chunk list, which isn't public API (MagicString is bundled, so the version is fixed;
 * the span map tests cover it).
 */
function getHiresSegments(str: MagicString) {
    const generated: number[] = [];
    const original: number[] = [];
    const magicString = str as unknown as { intro: string; firstChunk: Chunk };
    let position = magicString.intro.length;
    for (let chunk: Chunk | null = magicString.firstChunk; chunk; chunk = chunk.next) {
        position += chunk.intro.length;
        const content = chunk.content;
        if (chunk.edited) {
            if (content.length) {
                generated.push(position);
                original.push(chunk.start);
                let lineEnd = content.indexOf('\n');
                while (lineEnd !== -1 && lineEnd < content.length - 1) {
                    generated.push(position + lineEnd + 1);
                    original.push(chunk.start);
                    lineEnd = content.indexOf('\n', lineEnd + 1);
                }
            }
        } else {
            for (let i = 0; i < content.length; i++) {
                generated.push(position + i);
                original.push(chunk.start + i);
            }
        }
        position += content.length + chunk.outro.length;
    }
    return { generated, original };
}

interface Chunk {
    start: number;
    intro: string;
    content: string;
    outro: string;
    edited: boolean;
    next: Chunk | null;
}

export interface SpanMapOutput {
    /** The generated code, without markers */
    code: string;
    mappings: SpanMapping[];
    diagnosticDirectives: DiagnosticDirectives | undefined;
    /** Invalid segments or directives that were dropped. Should never happen */
    issues: string[] | undefined;
    /** MagicString's source map, for `code` */
    generateMap(options: Parameters<MagicString['generateDecodedMap']>[0]): SourceMap;
}

type Range = [start: number, end: number];

type Annotation =
    | {
          type: 'segment';
          originalStart: number;
          originalEnd: number;
          features: SpanMapFeature;
      }
    | { type: 'keepDiagnostics' };

/**
 * Lays the explicit segments over the derived ones: inside an explicit segment's range, only it
 * counts. Explicit segments can be nested, then the inner one wins inside its range.
 */
function overlay(derived: SpanMapping[], explicit: SpanMapping[]): SpanMapping[] {
    if (!explicit.length) {
        return derived;
    }

    let top: SpanMapping[] = [];
    for (const segment of [...explicit].sort((a, b) => a[0] - b[0] || b[1] - a[1])) {
        top = top.flatMap((existing) => cut(existing, segment[0], segment[0] + segment[1]));
        top.push(segment);
    }
    top.sort((a, b) => a[0] - b[0]);

    const result: SpanMapping[] = [];
    let first = 0;
    for (const segment of derived) {
        const end = segment[0] + segment[1];
        while (first < top.length && top[first][0] + top[first][1] <= segment[0]) {
            first++;
        }
        let pieces = [segment];
        for (let i = first; i < top.length && top[i][0] < end; i++) {
            pieces = pieces.flatMap((piece) => cut(piece, top[i][0], top[i][0] + top[i][1]));
        }
        result.push(...pieces);
    }
    result.push(...top);
    return result.sort((a, b) => a[0] - b[0]);
}

/** Removes `[start, end)` from the virtual range of `segment` */
function cut(segment: SpanMapping, start: number, end: number): SpanMapping[] {
    const segmentStart = segment[0];
    const segmentEnd = segmentStart + segment[1];
    if (end <= segmentStart || start >= segmentEnd) {
        return [segment];
    }
    const pieces: SpanMapping[] = [];
    if (segmentStart < start) {
        pieces.push(slice(segment, segmentStart, start));
    }
    if (end < segmentEnd) {
        pieces.push(slice(segment, end, segmentEnd));
    }
    return pieces;
}

function slice(segment: SpanMapping, from: number, to: number): SpanMapping {
    const [start, , originalStart, originalLength, kind, features] = segment;
    const result: SpanMapping =
        kind === SpanMapKind.Verbatim
            ? [from, to - from, originalStart + from - start, to - from, kind]
            : [from, to - from, originalStart, originalLength, kind];
    addFlag(result, features);
    return result;
}

/** Maps positions of the text with markers to positions of the text without them */
class PositionShift {
    /** Start of each removed range, in the text with markers */
    private starts: number[] = [];
    /** Characters removed up to and including each range */
    private removedUntil: number[] = [];

    constructor(private removed: Range[]) {
        let total = 0;
        for (const [start, end] of removed) {
            total += end - start;
            this.starts.push(start);
            this.removedUntil.push(total);
        }
    }

    map(position: number): number {
        // last range starting before position
        let low = 0;
        let high = this.starts.length - 1;
        let index = -1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            if (this.starts[mid] < position) {
                index = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        if (index === -1) {
            return position;
        }
        const [start, end] = this.removed[index];
        const removedBefore = index > 0 ? this.removedUntil[index - 1] : 0;
        return position >= end ? position - this.removedUntil[index] : start - removedBefore; // inside a removed range
    }

    apply(text: string): string {
        if (!this.removed.length) {
            return text;
        }
        let result = '';
        let last = 0;
        for (const [start, end] of this.removed) {
            result += text.slice(last, start);
            last = end;
        }
        return result + text.slice(last);
    }

    /** Markers never contain line breaks, so only columns change */
    applyToDecodedMappings(
        mappings: SourceMapSegment[][],
        textWithMarkers: string,
        text: string
    ): SourceMapSegment[][] {
        const lineStarts = getLineStarts(textWithMarkers);
        const newLineStarts = getLineStarts(text);
        return mappings.map((line, lineIndex) =>
            line.map((segment) => {
                const column =
                    this.map(lineStarts[lineIndex] + segment[0]) - newLineStarts[lineIndex];
                return [column, ...segment.slice(1)] as SourceMapSegment;
            })
        );
    }
}

/** Line starts the way MagicString counts lines */
function getLineStarts(text: string) {
    const starts = [0];
    let index = text.indexOf('\n');
    while (index !== -1) {
        starts.push(index + 1);
        index = text.indexOf('\n', index + 1);
    }
    return starts;
}

/**
 * One `Ignore` directive per ignore region, nested and adjacent regions merged, without the
 * `keep` ranges. Like TS6's `isInGeneratedCode`, a region without an end comment isn't ignored.
 */
function createIgnoreDirectives(
    code: string,
    keep: Range[],
    mappings: SpanMapping[]
): MappedDiagnosticDirective[] {
    const regions: Range[] = [];
    let depth = 0;
    let regionStart = 0;
    let nextStart = code.indexOf(IGNORE_START_COMMENT);
    let nextEnd = code.indexOf(IGNORE_END_COMMENT);
    while (nextEnd !== -1) {
        if (nextStart !== -1 && nextStart < nextEnd) {
            if (depth++ === 0) {
                regionStart = nextStart;
            }
            nextStart = code.indexOf(IGNORE_START_COMMENT, nextStart + IGNORE_START_COMMENT.length);
            continue;
        }
        const regionEnd = nextEnd + IGNORE_END_COMMENT.length;
        if (depth > 0 && --depth === 0) {
            const last = regions[regions.length - 1];
            if (last && last[1] >= regionStart) {
                last[1] = regionEnd;
            } else {
                regions.push([regionStart, regionEnd]);
            }
        }
        nextEnd = code.indexOf(IGNORE_END_COMMENT, regionEnd);
    }

    const sortedKeep = [...keep].sort((a, b) => a[0] - b[0]);
    const directives: MappedDiagnosticDirective[] = [];
    let mappingIndex = 0;
    let anchor = 0;
    for (const region of regions) {
        for (const [start, end] of subtract(region, sortedKeep)) {
            // The original range is informational: where the generated code is attached
            while (
                mappingIndex < mappings.length &&
                mappings[mappingIndex][0] + mappings[mappingIndex][1] <= start
            ) {
                anchor = mappings[mappingIndex][2] + mappings[mappingIndex][3];
                mappingIndex++;
            }
            directives.push([anchor, 0, start, end, DiagnosticDirectivePolicy.Ignore]);
        }
    }
    return directives;
}

function subtract([start, end]: Range, holes: Range[]): Range[] {
    const result: Range[] = [];
    let current = start;
    for (const [holeStart, holeEnd] of holes) {
        if (holeEnd <= current || holeStart >= end) {
            continue;
        }
        if (holeStart > current) {
            result.push([current, holeStart]);
        }
        current = Math.max(current, holeEnd);
    }
    if (current < end) {
        result.push([current, end]);
    }
    return result;
}

/**
 * Checks what TypeScript checks: segments sorted, non-overlapping, in bounds, `Verbatim` text
 * identical on both sides; directives valid and non-overlapping. An invalid span map gives an
 * error (100037), an invalid directive fails the whole transform.
 */
export function validateSpanMap(
    original: string,
    code: string,
    mappings: SpanMapping[],
    directives: MappedDiagnosticDirective[] = []
): string[] {
    return checkSpanMap(original, code, mappings, directives).issues;
}

/** Validates, and drops what's invalid (invalid segments, all directives if one is invalid) */
function checkSpanMap(
    original: string,
    code: string,
    mappings: SpanMapping[],
    directives: MappedDiagnosticDirective[]
) {
    const issues: string[] = [];
    const validMappings: SpanMapping[] = [];
    let previousEnd = 0;
    for (const mapping of mappings) {
        const issue = getSegmentIssue(original, code, mapping, previousEnd);
        if (issue) {
            issues.push(`${issue}: ${JSON.stringify(mapping)}`);
        } else {
            validMappings.push(mapping);
            previousEnd = mapping[0] + mapping[1];
        }
    }

    let directiveIssue = false;
    previousEnd = 0;
    for (const directive of directives) {
        const issue = getDirectiveIssue(original, code, directive, previousEnd);
        if (issue) {
            issues.push(`${issue}: ${JSON.stringify(directive)}`);
            directiveIssue = true;
        }
        previousEnd = directive[3];
    }

    return { mappings: validMappings, directives: directiveIssue ? [] : directives, issues };
}

function getSegmentIssue(
    original: string,
    code: string,
    [virtualStart, virtualLength, originalStart, originalLength, kind, features]: SpanMapping,
    previousEnd: number
): string | undefined {
    if (![virtualStart, virtualLength, originalStart, originalLength].every(isNonNegativeInt)) {
        return 'invalid number';
    }
    if (virtualLength === 0) {
        return 'empty segment';
    }
    if (virtualStart < previousEnd) {
        return 'segment overlaps or is out of order';
    }
    if (virtualStart + virtualLength > code.length) {
        return 'virtual range out of bounds';
    }
    if (originalStart + originalLength > original.length) {
        return 'original range out of bounds';
    }
    if (kind !== SpanMapKind.Verbatim && kind !== SpanMapKind.Atom && kind !== SpanMapKind.Alias) {
        return 'invalid kind';
    }
    if (features !== undefined && (!isNonNegativeInt(features) || features & ~SpanMapFeature.All)) {
        return 'invalid features';
    }
    if (
        kind === SpanMapKind.Verbatim &&
        (virtualLength !== originalLength ||
            code.slice(virtualStart, virtualStart + virtualLength) !==
                original.slice(originalStart, originalStart + originalLength))
    ) {
        return 'verbatim text differs';
    }
    return undefined;
}

function getDirectiveIssue(
    original: string,
    code: string,
    [
        originalStart,
        originalLength,
        virtualStart,
        virtualEnd,
        policy,
        index
    ]: MappedDiagnosticDirective,
    previousEnd: number
): string | undefined {
    if (![originalStart, originalLength, virtualStart, virtualEnd].every(isNonNegativeInt)) {
        return 'invalid number';
    }
    if (virtualStart >= virtualEnd || virtualEnd > code.length) {
        return 'invalid virtual range';
    }
    if (virtualStart < previousEnd) {
        return 'directive overlaps or is out of order';
    }
    if (originalStart + originalLength > original.length) {
        return 'original range out of bounds';
    }
    if (policy !== DiagnosticDirectivePolicy.Ignore || index !== undefined) {
        // svelte2tsx only creates Ignore directives
        return 'unexpected policy';
    }
    return undefined;
}

function isNonNegativeInt(value: number) {
    return Number.isInteger(value) && value >= 0;
}

function addFlag(span: SpanMapping, features: SpanMapFeature | undefined) {
    if (features === undefined) {
        return;
    }
    const existingFlags = span[5];
    if (existingFlags === undefined) {
        span[FEATURES_FLAGS] = features;
    } else {
        span[FEATURES_FLAGS] = existingFlags | features;
    }
}

interface Span {
    start: number;
    end: number;
    features: SpanMapFeature | undefined;
}

/** Returns `text` mapped to `original` (see `SpanMapGenerator.mapGenerated`) if span maps are generated */
export function mapGenerated(
    spanMapGenerator: SpanMapGenerator | undefined,
    text: string,
    original: [number, number],
    features?: SpanMapFeature
): string {
    return spanMapGenerator ? spanMapGenerator.mapGenerated(text, original, features) : text;
}

export enum SpanMapKind {
    /** Verbatim spans in virtual text have the same length and content as their counterparts in original text. */
    Verbatim = 0,
    /** Atom spans in virtual text may have different length and content than their counterparts in the original text. */
    Atom = 1,
    /** Alias spans in virtual text may have different length and content than their counterparts in the original text, but diagnostics display their original text. */
    Alias = 2
}

/** Controls which TypeScript language service features may use a span. */
export enum SpanMapFeature {
    None = 0,
    Hover = 1 << 0,
    SignatureHelp = 1 << 1,
    Completion = 1 << 2,
    Definition = 1 << 3,
    TypeDefinition = 1 << 4,
    Implementation = 1 << 5,
    References = 1 << 6,
    DocumentHighlights = 1 << 7,
    Rename = 1 << 8,
    CallHierarchy = 1 << 9,
    CodeActions = 1 << 10,
    Formatting = 1 << 11,
    InlayHints = 1 << 12,
    SemanticTokens = 1 << 13,
    FoldingRanges = 1 << 14,
    SelectionRanges = 1 << 15,
    LinkedEditing = 1 << 16,
    AutoInsert = 1 << 17,
    DocumentSymbols = 1 << 18,
    CodeLens = 1 << 19,
    /** Enables every language service feature. This is the default when `features` is omitted. */
    All = (CodeLens << 1) - 1
}

/** Positions and lengths are in the specified `positionEncoding`. */
export type SpanMapping = [
    virtualStart: number,
    virtualLength: number,
    originalStart: number,
    originalLength: number,
    kind: SpanMapKind,
    features?: SpanMapFeature
];

export enum DiagnosticDirectivePolicy {
    /** Drops TypeScript's semantic diagnostics that start in the virtual range */
    Ignore = 0,
    /** Like `Ignore`, but reports `unusedExpectDirectiveDiagnostics[index]` if it drops nothing */
    Expect = 1
}

/** Positions and lengths are in the specified `positionEncoding`. */
export type MappedDiagnosticDirective = [
    originalStart: number,
    originalLength: number,
    virtualStart: number,
    virtualEnd: number,
    policy: DiagnosticDirectivePolicy,
    unusedExpectDirectiveIndex?: number
];

export interface DiagnosticDirectives {
    unusedExpectDirectiveDiagnostics: Array<{ code: number; messageText: string }>;
    directives: MappedDiagnosticDirective[];
}
