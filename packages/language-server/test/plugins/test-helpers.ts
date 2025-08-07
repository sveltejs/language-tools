import { VERSION } from 'svelte/compiler';

// Helper to detect which Svelte version is actually being used at runtime
export function getSvelteVersion(): { major: number; full: string; isSvelte5Plus: boolean } {
    const major = Number(VERSION.split('.')[0]);
    return {
        major,
        full: VERSION,
        isSvelte5Plus: major >= 5
    };
}

export const svelteVersion = getSvelteVersion();