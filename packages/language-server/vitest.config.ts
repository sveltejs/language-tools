import { defineConfig } from 'vitest/config';

const isSvelte5 = process.env.SVELTE_VERSION === '5';

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        globals: true,
        environment: 'node',
        // Use alias for Svelte 5 testing
        ...(isSvelte5 && {
            alias: [
                {
                    find: /^svelte$/,
                    replacement: 'svelte5',
                },
                {
                    find: /^svelte\/(.*)/,
                    replacement: 'svelte5/$1',
                },
            ],
        }),
    },
});