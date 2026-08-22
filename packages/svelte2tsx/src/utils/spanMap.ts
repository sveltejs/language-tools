import MagicString, { SourceMapSegment } from 'magic-string';
import ts from 'typescript';
import { COMPONENT_SUFFIX } from '../svelte2tsx/addComponentExport';

const GENERATE_START = 0;
const GENERATE_LENGTH = 1;
const ORIGINAL_START = 2;
const ORIGINAL_LENGTH = 3;
const KIND = 4;

const constStart = 'const ';

export class SpanMapGenerator {
    private spans: Span[] = [];

    /**
     * Add an identifier or literal span to the list of spans to be mapped.
     * The span is defined by its start and end positions in the original source code.
     */
    addSourceSpan(start: number, end: number) {
        this.spans.push({ start, end });
    }

    generateSpanMapping(
        str: MagicString,
        generatedCode: string,
        options: {
            svelte5Plus: boolean;
        }
    ): SpanMapping[] {
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
                                SpanMapKind.Atom
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
        const result: SpanMapping[] = [];
        for (let i = 0; i < mappings.length - 1; i++) {
            const current = mappings[i];
            const next = mappings[i + 1];
            const currentEnd = current[ORIGINAL_START] + current[ORIGINAL_LENGTH];
            if (currentEnd > next[ORIGINAL_START]) {
                const newLength = next[ORIGINAL_START] - current[ORIGINAL_START];
                if (newLength > 0) {
                    current[ORIGINAL_LENGTH] = newLength;
                    result.push(current);
                }
                continue;
            }

            if (exact(str.original, generatedCode, current)) {
                current[KIND] = SpanMapKind.Verbatim;
            }
            result.push(current);
        }

        this.addDefaultExportMapping(generatedCode, result, options.svelte5Plus);

        return result;
    }

    private addDefaultExportMapping(
        generatedCode: string,
        result: SpanMapping[],
        svelte5Plus: boolean
    ) {
        const componentSuffixIndex = generatedCode.lastIndexOf(COMPONENT_SUFFIX);
        const startOfName = generatedCode.lastIndexOf(' ', componentSuffixIndex) + 1;
        const name = generatedCode.substring(
            startOfName,
            componentSuffixIndex + COMPONENT_SUFFIX.length
        );

        let index = startOfName;
        if (!svelte5Plus) {
            result.push([index, name.length, 0, 0, SpanMapKind.Atom, SpanMapFeature.Definition]);
            return;
        }
        
        const constIndex = generatedCode.lastIndexOf(constStart + name, startOfName);
        if (constIndex !== -1) {
            result.push([
                constIndex,
                name.length + constStart.length,
                0,
                0,
                SpanMapKind.Atom,
                SpanMapFeature.Definition
            ]);
        }
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
