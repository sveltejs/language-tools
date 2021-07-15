/**
 * Throw an error with start/end pos like the Svelte compiler does
 */
export function throwError(start: number, end: number, message: string, code: string) {
    const error = new Error(message);
    (error as any).start = positionAt(start, code);
    (error as any).end = positionAt(end, code);
    throw error;
}

/**
 * Get the line (1-offset) and character (0-offset) based on the offset
 * @param offset The index of the position
 * @param text The text for which the position should be retrived
 */
function positionAt(offset: number, text: string): { line: number; column: number } {
    offset = clamp(offset, 0, text.length);

    const lineOffsets = getLineOffsets(text);
    let low = 0;
    let high = lineOffsets.length;
    if (high === 0) {
        return { line: 1, column: offset };
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
    return { line: low, column: offset - lineOffsets[low - 1] };
}

export function clamp(num: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, num));
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
