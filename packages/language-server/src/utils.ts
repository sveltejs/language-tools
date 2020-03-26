import { URI } from 'vscode-uri';

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

const TS2552_REGEX = /Cannot find name '\$([a-zA-Z0-9_]+)'. Did you mean '([a-zA-Z0-9_]+)'\?/i;
export function isValidSvelteReactiveValueDiagnostic(diagnostic: any): boolean {
  if (diagnostic.code !== 2552) return true;

  /** if error message doesn't contain a reactive value, do nothing */
  if (!diagnostic.message.includes('$')) return true;

  const [, usedVar, proposedVar] = diagnostic.message.match(TS2552_REGEX) || [];

  return !(usedVar && proposedVar && usedVar === proposedVar);
} 