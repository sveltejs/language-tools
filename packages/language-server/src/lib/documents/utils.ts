import { clamp, isInRange } from '../../utils';
import { Position, Range } from 'vscode-languageserver';

export interface TagInformation {
    content: string;
    attributes: Record<string, string>;
    start: number;
    end: number;
    startPos: Position;
    endPos: Position;
    container: { start: number; end: number };
}

function parseAttributeValue(value: string): string {
    return /^['"]/.test(value) ? value.slice(1, -1) : value;
}

function parseAttributes(str: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    str.split(/\s+/)
        .filter(Boolean)
        .forEach((attr) => {
            const [name, value] = attr.split('=');
            attrs[name] = value ? parseAttributeValue(value) : name;
        });
    return attrs;
}

const EXTRACT_TAG_EXCLUSIONS = [
    '{#if[\\s\\S]*{\\/if}',
    '<!--[\\s\\S]*-->',
    '{#each[\\s\\S]*{\\/each}',
    '{#await[\\s\\S]*{\\/await}',
    '{@html[\\s\\S]+}',
];
const EXTRACT_TAG_EXCLUSION_EXPS = EXTRACT_TAG_EXCLUSIONS.map((exp) => new RegExp(exp));
/**
 * Extracts a tag (style or script) from the given text
 * and returns its start, end and the attributes on that tag.
 *
 * @param source text content to extract tag from
 * @param tag the tag to extract
 */
export function extractTag(source: string, tag: 'script' | 'style'): TagInformation | null {
    const exp = new RegExp(
        `(${EXTRACT_TAG_EXCLUSIONS.join(')|(')})|(<${tag}(\\s[\\S\\s]*?)?>)([\\S\\s]*?)<\\/${tag}>`,
        'igs',
    );
    let match = exp.exec(source);
    while (
        match &&
        EXTRACT_TAG_EXCLUSION_EXPS.some((exclusionExp) => exclusionExp.exec(match?.[0] ?? ''))
    ) {
        match = exp.exec(source);
    }

    if (!match) {
        return null;
    }

    const attributes = parseAttributes(match[7] || '');
    const content = match[8];
    const start = match.index + match[6].length;
    const end = start + content.length;
    const startPos = positionAt(start, source);
    const endPos = positionAt(end, source);

    return {
        content,
        attributes,
        start,
        end,
        startPos,
        endPos,
        container: { start: match.index, end: match.index + match[0].length },
    };
}

/**
 * Get the line and character based on the offset
 * @param offset The index of the position
 * @param text The text for which the position should be retrived
 */
export function positionAt(offset: number, text: string): Position {
    offset = clamp(offset, 0, text.length);

    const lineOffsets = getLineOffsets(text);
    let low = 0;
    let high = lineOffsets.length;
    if (high === 0) {
        return Position.create(0, offset);
    }

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (lineOffsets[mid] > offset) {
            high = mid;
        } else {
            low = mid + 1;
        }
    }

    // low is the least x for which the line offset is larger than the current offset
    // or array.length if no line offset is larger than the current offset
    const line = low - 1;
    return Position.create(line, offset - lineOffsets[line]);
}

/**
 * Get the offset of the line and character position
 * @param position Line and character position
 * @param text The text for which the offset should be retrived
 */
export function offsetAt(position: Position, text: string): number {
    const lineOffsets = getLineOffsets(text);

    if (position.line >= lineOffsets.length) {
        return text.length;
    } else if (position.line < 0) {
        return 0;
    }

    const lineOffset = lineOffsets[position.line];
    const nextLineOffset =
        position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : text.length;

    return clamp(nextLineOffset, lineOffset, lineOffset + position.character);
}

function getLineOffsets(text: string) {
    const lineOffsets = [];
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

export function isInTag(position: Position, tagInfo: TagInformation | null): boolean {
    return !!tagInfo && isInRange(Range.create(tagInfo.startPos, tagInfo.endPos), position);
}
