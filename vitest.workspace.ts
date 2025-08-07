import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Svelte 5 tests (default - current version)
  {
    extends: './packages/language-server/vitest.config.ts',
    test: {
      name: 'svelte5',
      include: ['packages/language-server/test/**/*.test.ts'],
    },
  },
  // Svelte 4 tests - for backwards compatibility
  {
    extends: './packages/language-server/vitest.config.ts', 
    test: {
      name: 'svelte4',
      include: ['packages/language-server/test/**/*.test.ts'],
      exclude: ['packages/language-server/test/**/*.v5/**'],
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
]);