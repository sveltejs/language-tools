import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        globals: true,
        environment: 'node',
        name: 'svelte5',
        projects: [
            {
                name: 'svelte5',
                test: {
                    include: ['test/**/*.test.ts'],
                    globals: true,
                    environment: 'node'
                }
            },
            {
                name: 'svelte4',
                test: {
                    include: ['test/**/*.test.ts'],
                    exclude: ['test/**/*.v5/**'],
                    globals: true,
                    environment: 'node'
                },
                resolve: {
                    alias: [
                        {
                            find: /^svelte$/,
                            replacement: 'svelte4',
                        },
                        {
                            find: /^svelte\/(.*)/,
                            replacement: 'svelte4/$1',
                        },
                    ],
                },
            },
        ],
    }
});