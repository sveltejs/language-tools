export function isSvelteFilePath(filePath: string) {
    return filePath.endsWith('.svelte');
}

export function isVirtualSvelteFilePath(filePath: string) {
    return filePath.endsWith('.svelte.ts');
}

export function toRealSvelteFilePath(filePath: string) {
    return filePath.slice(0, -'.ts'.length);
}

export function ensureRealSvelteFilePath(filePath: string) {
    return isVirtualSvelteFilePath(filePath) ? toRealSvelteFilePath(filePath) : filePath;
}

export function isNotNullOrUndefined<T>(val: T | undefined | null): val is T {
    return val !== undefined && val !== null;
}
