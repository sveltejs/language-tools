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

// IMPORTANT: Don't cache this at module level - it needs to be called fresh for each test run
// When using Vitest workspaces, the same test file runs multiple times with different configurations
export function isSvelte5Plus(): boolean {
    return Number(VERSION.split('.')[0]) >= 5;
}

// Deprecated - use isSvelte5Plus() function instead
export const svelteVersion = getSvelteVersion();
