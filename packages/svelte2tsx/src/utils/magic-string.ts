import MagicString from 'magic-string';

/**
 * Prepends a string at the given index in a way that the source map maps the appended string
 * to the given character, not the previous character (as MagicString's other methods would).
 */
export function preprendStr(str: MagicString, index: number, toAppend: string): MagicString {
    str.overwrite(index, index + 1, toAppend + str.original.charAt(index), { contentOnly: true });
    return str;
}
