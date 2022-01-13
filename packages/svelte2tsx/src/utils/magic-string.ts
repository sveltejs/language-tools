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
 * Overwrites a string at the given index but also keeps the other preprends from `prependStr`
 * if not explicitely told otherwise.
 */
export function overwriteStr(
    str: MagicString,
    index: number,
    toOverwrite: string,
    removeExisting?: boolean
): MagicString {
    const prepends = updatePrepends(str, index, toOverwrite, removeExisting);
    toOverwrite = prepends.join('');
    str.overwrite(index, index + 1, toOverwrite, { contentOnly: true });
    return str;
}

function updatePrepends(
    str: MagicString,
    index: number,
    toAppend: string,
    removeExisting?: boolean
) {
    (str as any).__prepends__ = (str as any).__prepends__ || new Map<string, string[]>();
    const prepends = removeExisting ? [] : (str as any).__prepends__.get(index) || [];
    prepends.push(toAppend);
    (str as any).__prepends__.set(index, prepends);
    return prepends;
}
