import { URI } from 'vscode-uri';
import { Position, Range } from 'vscode-languageserver';

export function clamp(num: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, num));
}

export function urlToPath(stringUrl: string): string | null {
    const url = URI.parse(stringUrl);
    if (url.scheme !== 'file') {
        return null;
    }
    return url.fsPath.replace(/\\/g, '/');
}

export function pathToUrl(path: string) {
    return URI.file(path).toString();
}

/**
 * URIs coming from the client could be encoded in a different
 * way than expected / than the internal services create them.
 * This normalizes them to be the same as the internally generated ones.
 */
export function normalizeUri(uri: string): string {
    return URI.parse(uri).toString();
}

export function flatten<T>(arr: T[][]): T[] {
    return arr.reduce((all, item) => [...all, ...item], []);
}

export function isInRange(range: Range, positionToTest: Position): boolean {
    return (
        isBeforeOrEqualToPosition(range.end, positionToTest) &&
        isBeforeOrEqualToPosition(positionToTest, range.start)
    );
}

export function isBeforeOrEqualToPosition(position: Position, positionToTest: Position): boolean {
    return (
        positionToTest.line < position.line ||
        (positionToTest.line === position.line && positionToTest.character <= position.character)
    );
}

export function isNotNullOrUndefined<T>(val: T | undefined | null): val is T {
    return val !== undefined && val !== null;
}

/**
 * Debounces a function but cancels previous invocation only if
 * a second function determines it should.
 *
 * @param fn The function with it's argument
 * @param determineIfSame The function which determines if the previous invocation should be canceld or not
 * @param miliseconds Number of miliseconds to debounce
 */
export function debounceSameArg<T>(
    fn: (arg: T) => void,
    shouldCancelPrevious: (newArg: T, prevArg?: T) => boolean,
    miliseconds: number
): (arg: T) => void {
    let timeout: any;
    let prevArg: T | undefined;

    return (arg: T) => {
        if (shouldCancelPrevious(arg, prevArg)) {
            clearTimeout(timeout);
        }

        prevArg = arg;
        timeout = setTimeout(() => {
            fn(arg);
            prevArg = undefined;
        }, miliseconds);
    };
}

/**
 * Like str.lastIndexOf, but for regular expressions. Note that you need to provide the g-flag to your RegExp!
 */
export function regexLastIndexOf(text: string, regex: RegExp, endPos?: number) {
    if (endPos === undefined) {
        endPos = text.length;
    } else if (endPos < 0) {
        endPos = 0;
    }

    const stringToWorkWith = text.substring(0, endPos + 1);
    let lastIndexOf = -1;
    let result: RegExpExecArray | null = null;
    while ((result = regex.exec(stringToWorkWith)) !== null) {
        lastIndexOf = result.index;
    }
    return lastIndexOf;
}

/**
 * Get all matches of a regexp.
 */
export function getRegExpMatches(regex: RegExp, str: string) {
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(str))) {
        matches.push(match);
    }
    return matches;
}

/**
 * Function to modify each line of a text, preserving the line break style (`\n` or `\r\n`)
 */
export function modifyLines(
    text: string,
    replacementFn: (line: string, lineIdx: number) => string
): string {
    let idx = 0;
    return text
        .split('\r\n')
        .map((l1) =>
            l1
                .split('\n')
                .map((line) => replacementFn(line, idx++))
                .join('\n')
        )
        .join('\r\n');
}

/**
 * Like array.filter, but asynchronous
 */
export async function filterAsync<T>(
    array: T[],
    predicate: (t: T, idx: number) => Promise<boolean>
): Promise<T[]> {
    const fail = Symbol();
    return (
        await Promise.all(
            array.map(async (item, idx) => ((await predicate(item, idx)) ? item : fail))
        )
    ).filter((i) => i !== fail) as T[];
}

export function getIndent(text: string) {
    return /^[ |\t]+/.exec(text)?.[0] ?? '';
}
