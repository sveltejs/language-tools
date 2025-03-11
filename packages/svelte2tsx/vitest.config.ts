import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        // globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts']
    },
    resolve: {
        alias: {
            svelte2tsx: resolve(__dirname, 'src')
        }
    }
});
