import { Node } from 'estree-walker';
import MagicString from 'magic-string';
import { BaseDirective } from '../../interfaces';

/**
 * A transformation array consists of three types:
 * - string: a generated code that is appended
 * - [number, number]: original code that is included in the transformation as-is
 * - number: a position after which things that should be deleted are moved to the end first
 */
export type TransformationArray = Array<string | [number, number] | number>;

/**
 * Moves or inserts text to the specified end in order.
 * "In order" means that the transformation of the text before
 * the given position reads exactly what was moved/inserted
 * from left to right.
 * After the transformation is done, everything inside the start-end-range that was
 * not moved will be removed. If there's a delete position given, things will be moved
 * to the end first before getting deleted. This may ensure better mappings for auto completion
 * for example.
 */
export function transform(
    str: MagicString,
    start: number,
    end: number,
    _xxx: number, // TODO
    transformations: TransformationArray
) {
    const moves: Array<[number, number]> = [];
    let appendPosition = end;
    let ignoreNextString = false;
    let deletePos: number | undefined;
    let deleteDest: number | undefined;
    for (let i = 0; i < transformations.length; i++) {
        const transformation = transformations[i];
        if (typeof transformation === 'number') {
            deletePos = moves.length;
            deleteDest = transformation;
        } else if (typeof transformation === 'string') {
            if (!ignoreNextString) {
                str.appendLeft(appendPosition, transformation);
            }
            ignoreNextString = false;
        } else {
            const tStart = transformation[0];
            let tEnd = transformation[1];
            if (tStart === tEnd) {
                // zero-range selection, don't move, it would
                // cause bugs and isn't necessary anyway
                continue;
            }

            if (
                tEnd < end - 1 &&
                // TODO can we somehow make this more performant?
                !transformations.some(
                    (t) => typeof t !== 'string' && (t[0] === tEnd + 1 || t[0] === tEnd)
                )
            ) {
                tEnd += 1;
                const next = transformations[i + 1];
                ignoreNextString = typeof next === 'string';
                // Do not append the next string, rather overwrite the next character. This ensures
                // that mappings of the string afterwards are not mapped to a previous character, making
                // mappings of ranges one character too short. If there's no string in the next transformation,
                // completely delete the first character afterwards. This also makes the mapping more correct,
                // so that autocompletion triggered on the last character works correctly.
                const overwrite = typeof next === 'string' ? next : '';
                str.overwrite(tEnd - 1, tEnd, overwrite, { contentOnly: true });
            }

            appendPosition = ignoreNextString ? tEnd : transformation[1];
            moves.push([tStart, tEnd]);
        }
    }

    deletePos = deletePos ?? moves.length;
    for (let i = 0; i < deletePos; i++) {
        str.move(moves[i][0], moves[i][1], end);
    }

    let removeStart = start;
    for (const transformation of [...moves].sort((t1, t2) => t1[0] - t2[0])) {
        if (removeStart < transformation[0]) {
            if (deletePos !== moves.length && removeStart > deleteDest) {
                str.move(removeStart, transformation[0], end);
            }
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
        // Use one space because of hover etc: This will map deleted characters to the whitespace
        if (deletePos !== moves.length && removeStart > deleteDest && removeStart + 1 < end) {
            // Can only move stuff up to the end, not including, else we get a "cannot move inside itself" error
            str.move(removeStart, end - 1, end);
            str.overwrite(removeStart, end - 1, ' ', { contentOnly: true });
            str.overwrite(end - 1, end, '', { contentOnly: true });
        } else {
            str.overwrite(removeStart, end, ' ', { contentOnly: true });
        }
    }

    for (let i = deletePos; i < moves.length; i++) {
        str.move(moves[i][0], moves[i][1], end);
    }
}

/**
 * Surrounds given range with a prefix and suffix. This is benefitial
 * for better mappings in some cases. Example: If we transform `foo` to `"foo"`
 * and if TS underlines the whole `"foo"`, we need to make sure that the quotes
 * are also mapped to the correct positions.
 * Returns the input start/end transformation for convenience.
 */
export function surroundWith(
    str: MagicString,
    [start, end]: [number, number],
    prefix: string,
    suffix: string
): [number, number] {
    if (start + 1 === end) {
        str.overwrite(start, end, `${prefix}${str.original.charAt(start)}${suffix}`, {
            contentOnly: true
        });
    } else {
        str.overwrite(start, start + 1, `${prefix}${str.original.charAt(start)}`, {
            contentOnly: true
        });
        str.overwrite(end - 1, end, `${str.original.charAt(end - 1)}${suffix}`, {
            contentOnly: true
        });
    }
    return [start, end];
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

/**
 * Check if there's a member access trailing behind given expression and if yes,
 * bump the position to include it.
 * Usually it's there because of the preprocessing we do before we let Svelte parse the template.
 */
export function withTrailingPropertyAccess(originalText: string, position: number): number {
    let index = position;

    while (index < originalText.length) {
        const char = originalText[index];

        if (!char.trim()) {
            index++;
            continue;
        }

        if (char === '.') {
            return index + 1;
        }

        if (char === '?' && originalText[index + 1] === '.') {
            return index + 2;
        }

        break;
    }

    return position;
}

export function rangeWithTrailingPropertyAccess(
    originalText: string,
    node: { start: number; end: number }
): [start: number, end: number] {
    return [node.start, withTrailingPropertyAccess(originalText, node.end)];
}
