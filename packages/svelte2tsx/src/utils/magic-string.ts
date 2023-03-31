import MagicString from 'magic-string';

/**
 * Prepends a string at the given index in a way that the source map maps the appended string
 * to the given character, not the previous character (as MagicString's other methods would).
 */
export function preprendStr(
    str: MagicString,
    index: number,
    toAppend: string,
    removeExisting?: boolean
): MagicString {
    const prepends = updatePrepends(str, index, toAppend, removeExisting);
    toAppend = prepends.join('');
    str.overwrite(index, index + 1, toAppend + str.original.charAt(index), { contentOnly: true });
    return str;
}

/**
 * Overwrites a string at the given range but also keeps the other preprends from `prependStr`
 * if not explicitly told otherwise.
 */
export function overwriteStr(
    str: MagicString,
    start: number,
    end: number,
    toOverwrite: string,
    removeExisting?: boolean
): MagicString {
    const prepends = updatePrepends(str, start, toOverwrite, removeExisting);
    toOverwrite = prepends.join('');
    str.overwrite(start, end, toOverwrite, { contentOnly: true });
    return str;
}

function updatePrepends(
    str: MagicString,
    index: number,
    toAppend: string,
    removeExisting?: boolean
): string[] {
    (str as any).__prepends__ = (str as any).__prepends__ || new Map<number, string[]>();
    const prepends = removeExisting ? [] : (str as any).__prepends__.get(index) || [];
    prepends.push(toAppend);
    (str as any).__prepends__.set(index, prepends);
    return prepends;
}

/**
 * Returns the prepends that were added at the given index (if any).
 */
export function getCurrentPrepends(str: MagicString, index: number): string[] {
    return (str as any).__prepends__?.get(index) || [];
}
