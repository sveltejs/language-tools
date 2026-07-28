import MagicString, { SourceMapSegment } from 'magic-string';
import ts from 'typescript';

const GENERATE_START = 0;
const GENERATE_LENGTH = 1;
const ORIGINAL_START = 2;
const ORIGINAL_LENGTH = 3;
const KIND = 4;
// const PURPOSE = 5;

export class SpanMapGenerator {
    private spans: Span[] = [];

    /**
     * Add an identifier or literal span to the list of spans to be mapped.
     * The span is defined by its start and end positions in the original source code.
     */
    addSourceSpan(start: number, end: number) {
        this.spans.push({ start, end });
    }

    generateSpanMapping(str: MagicString, generatedCode: string): SpanMapping[] {
        const lineOffsets = getLineOffsets(generatedCode);
        const orgLineOffsets = getLineOffsets(str.original);
        const mappings: SpanMapping[] = [];
        const map = str.generateDecodedMap({ hires: true }).mappings;
        const sourceSpanMap = new Map<number, Span>();
        for (const span of this.spans) {
            sourceSpanMap.set(span.start, span);
        }

        for (let generatedLine = 0; generatedLine < map.length; generatedLine++) {
            const line = map[generatedLine];

            let current: SpanMapping | undefined;
            let currentSourceSpan: Span | undefined;
            for (let segmentIndex = 0; segmentIndex < line.length; segmentIndex++) {
                const segment = line[segmentIndex];
                const currentLineOffset = lineOffsets[generatedLine];
                const originalStart = getSourceOffset(segment, orgLineOffsets);
                if (originalStart === undefined) {
                    current = undefined;
                    currentSourceSpan = undefined;
                    continue;
                }

                const generatedStart = currentLineOffset + segment[0];
                const sourceSpan = sourceSpanMap.get(originalStart);

                // end is exclusive, so if it is equal to the current originalStart, it means we are outside of the span
                if (sourceSpan || (currentSourceSpan && originalStart >= currentSourceSpan.end)) {
                    current = undefined;
                    currentSourceSpan = sourceSpan;
                }

                const sourceChar = str.original.charCodeAt(originalStart);
                const sameChar = generatedCode.charCodeAt(generatedStart) === sourceChar;

                if (sourceSpan && !sameChar) {
                    const nextSegment = line[segmentIndex + 1];
                    if (nextSegment) {
                        const nextOriginalStart = getSourceOffset(nextSegment, orgLineOffsets);
                        const nextGeneratedStart = currentLineOffset + nextSegment[0];
                        if (
                            nextOriginalStart === originalStart + 1 &&
                            generatedCode.charCodeAt(nextGeneratedStart - 1) === sourceChar
                        ) {
                            current = [
                                nextGeneratedStart - 1,
                                2,
                                originalStart,
                                2,
                                SpanMapKind.Alias
                            ];
                            segmentIndex++;
                            mappings.push(current);
                            continue;
                        }
                    }
                }

                if (current) {
                    let previousSegment = line[segmentIndex - 1];
                    if (previousSegment && sameChar) {
                        if (
                            nextTo(segment, previousSegment) &&
                            (currentSourceSpan ||
                                isIdentifierPart(generatedCode.charCodeAt(generatedStart)))
                        ) {
                            current[GENERATE_LENGTH]++;
                            current[ORIGINAL_LENGTH]++;
                            continue;
                        }
                    }
                }

                current = [
                    generatedStart,
                    1,
                    originalStart,
                    1,
                    sameChar ? SpanMapKind.Verbatim : SpanMapKind.Atom
                ];
                mappings.push(current);
            }
        }

        mappings.sort((a, b) => a[ORIGINAL_START] - b[ORIGINAL_START]);
        for (let i = 0; i < mappings.length - 1; i++) {
            const current = mappings[i];
            const next = mappings[i + 1];
            const currentEnd = current[ORIGINAL_START] + current[ORIGINAL_LENGTH];
            if (currentEnd > next[ORIGINAL_START]) {
                current[ORIGINAL_LENGTH] = next[ORIGINAL_START] - current[ORIGINAL_START];
            }

            if (exact(str.original, generatedCode, current)) {
                current[KIND] = SpanMapKind.Verbatim;
            }
        }
        return mappings.filter((m) => m[ORIGINAL_LENGTH] > 0);
    }
}

function getSourceOffset(segment: SourceMapSegment, sourceLineOffsets: number[]) {
    const [, , originalLine, originalCharacter] = segment;
    if (originalLine === undefined || originalCharacter === undefined) {
        return undefined;
    }

    return sourceLineOffsets[originalLine] + originalCharacter;
}

function isIdentifierPart(charCode: number) {
    return ts.isIdentifierPart(charCode, ts.ScriptTarget.Latest);
}

function nextTo(segment: SourceMapSegment, previous: SourceMapSegment) {
    const [generatedCharacter, , originalLine, originalCharacter] = segment;
    const [prevGeneratedCharacter, , prevOriginalLine, prevOriginalCharacter] = previous;

    return (
        originalLine === prevOriginalLine &&
        originalCharacter === prevOriginalCharacter + 1 &&
        generatedCharacter === prevGeneratedCharacter + 1
    );
}

function exact(original: string, generatedCode: string, mapping: SpanMapping) {
    const generatedLength = mapping[GENERATE_LENGTH];
    const originLength = mapping[ORIGINAL_LENGTH];
    if (generatedLength !== originLength) {
        return false;
    }
    for (let i = 0; i < generatedLength; i++) {
        const generatedChar = generatedCode.charCodeAt(mapping[GENERATE_START] + i);
        const originalChar = original.charCodeAt(mapping[ORIGINAL_START] + i);
        if (generatedChar !== originalChar) {
            return false;
        }
    }

    return true;
}

interface Span {
    start: number;
    end: number;
}

function getLineOffsets(text: string) {
    const lineOffsets: number[] = [];
    let isLineStart = true;

    for (let i = 0; i < text.length; i++) {
        if (isLineStart) {
            lineOffsets.push(i);
            isLineStart = false;
        }
        const ch = text.charAt(i);
        isLineStart = ch === '\r' || ch === '\n';
        if (ch === '\r' && i + 1 < text.length && text.charAt(i + 1) === '\n') {
            i++;
        }
    }

    if (isLineStart && text.length > 0) {
        lineOffsets.push(text.length);
    }

    return lineOffsets;
}

export enum SpanMapKind {
    /** Verbatim spans in generated output have the same length and content as their counterparts in original text. */
    Verbatim = 0,
    /** Atom spans in generated output may have different length and content than their counterparts in the original text. */
    Atom = 1,
    /** Alias spans in generated output may have different length and content than their counterparts in the original text, but diagnostics display their original text. */
    Alias = 2
}

/**
 * SpanMapPurpose controls which TypeScript language service features will activate using a span
 * in the transformed content given a request position in the original content.
 */
enum SpanMapPurpose {
    /** Disables all language service features for the span. */
    None = 0,
    /** Used by features that inspect semantic information, such as hover, signature help, and completions. */
    Semantic = 1 << 0,
    /** Used by features that locate symbols, such as definitions, references, rename, and call hierarchy. */
    Navigation = 1 << 1,
    /** Enables both semantic and navigation features. This is the default when `purpose` is omitted. */
    All = Semantic | Navigation
}

/** Positions and lengths are in the specified `positionEncoding`. */
export type SpanMapping = [
    generatedStart: number,
    generatedLength: number,
    originalStart: number,
    originalLength: number,
    kind: SpanMapKind,
    purpose?: SpanMapPurpose
];
