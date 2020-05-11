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
    return positionToTest.line < position.line || positionToTest.character <= position.character;
}
