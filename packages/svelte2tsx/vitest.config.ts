import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/**/index.ts'],
        exclude: ['test/build/**', 'test/test.ts', 'test/emitDts/samples/**/src/**'],
        globals: true,
        environment: 'node'
    }
});
