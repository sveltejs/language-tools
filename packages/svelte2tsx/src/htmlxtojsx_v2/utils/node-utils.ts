import { Node } from 'estree-walker';
import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';

export type TransformationArray = Array<string | [number, number]>;

/**
 * Moves or inserts text to a specific location in order.
 * "In order" means that the transformation of the text before
 * the given position reads exactly what was moved/inserted
 * from left to right.
 * After the transformation is done, everything inside the start-end-range that was
 * not moved will be removed.
 */
export function transform(
    str: MagicString,
    start: number,
    end: number,
    position: number,
    transformations: TransformationArray
) {
    const moves: Array<[number, number]> = [];
    let appendPosition = position;
    let ignoreNextString = false;
    for (let i = 0; i < transformations.length; i++) {
        const transformation = transformations[i];
        if (typeof transformation === 'string') {
            if (!ignoreNextString) {
                str.appendLeft(appendPosition, transformation);
            }
            ignoreNextString = false;
        } else {
            const start = transformation[0];
            let end = transformation[1];
            if (start === end) {
                // zero-range selection, don't move, it would
                // cause bugs and isn't necessary anyway
                continue;
            }

            if (
                end < position - 1 &&
                // TODO can we somehow make this more performant?
                !transformations.some(
                    (t) => typeof t !== 'string' && (t[0] === end + 1 || t[0] === end)
                )
            ) {
                end += 1;
                const next = transformations[i + 1];
                ignoreNextString = typeof next === 'string';
                // Do not append the next string, rather overwrite the next character. This ensures
                // that mappings of the string afterwards are not mapped to a previous character, making
                // mappings of ranges one character too short. If there's no string in the next transformation,
                // completely delete the first character afterwards. This also makes the mapping more correct,
                // so that autocompletion triggered on the last character works correctly.
                const overwrite = typeof next === 'string' ? next : '';
                str.overwrite(end - 1, end, overwrite, { contentOnly: true });
            }

            str.move(start, end, position);
            appendPosition = ignoreNextString ? end : transformation[1];
            moves.push([start, end]);
        }
    }

    let removeStart = start;
    for (const transformation of moves.sort((t1, t2) => t1[0] - t2[0])) {
        if (removeStart < transformation[0]) {
            // Use one space because of hover etc: This will make map deleted characters to the whitespace
            str.overwrite(removeStart, transformation[0], ' ', { contentOnly: true });
        }
        removeStart = transformation[1];
    }

    if (removeStart < end) {
        // Completely delete the first character afterwards. This makes the mapping more correct,
        // so that autocompletion triggered on the last character works correctly.
        str.overwrite(removeStart, removeStart + 1, '', { contentOnly: true });
        removeStart++;
    }
    if (removeStart < end) {
        // Use one space because of hover etc: This will make map deleted characters to the whitespace
        str.overwrite(removeStart, end, ' ', { contentOnly: true });
    }
}

/**
 * Returns the [start, end] indexes of a directive (action,animation,etc) name.
 * Example: use:foo --> [startOfFoo, endOfFoo]
 */
export function getDirectiveNameStartEndIdx(
    str: MagicString,
    node: BaseDirective
): [number, number] {
    const colonIdx = str.original.indexOf(':', node.start);
    return [colonIdx + 1, colonIdx + 1 + `${node.name}`.length];
}

/**
 * Removes characters from the string that are invalid for TS variable names.
 * Careful: This does not check if the leading character
 * is valid (numerical values aren't for example).
 */
export function sanitizePropName(name: string): string {
    return name
        .split('')
        .map((char) => (/[0-9A-Za-z$_]/.test(char) ? char : '_'))
        .join('');
}

export function isShortHandAttribute(attr: Node): boolean {
    return attr.expression.end === attr.end;
}

export function isQuote(str: string): boolean {
    return str === '"' || str === "'";
}
