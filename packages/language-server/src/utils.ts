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
    miliseconds: number,
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
