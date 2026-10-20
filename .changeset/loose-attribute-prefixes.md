---
'svelte2tsx': minor
'svelte-language-server': minor
'svelte-check': minor
'typescript-svelte-plugin': minor
---

feat: `svelteOptions.looseAttributePrefixes` tsconfig option to exempt prefixed attributes from type checking. Attributes matching a configured prefix (e.g. `mystuff:`) are treated like `data-*` attributes — accepted on any element or component, but untyped. Useful when a preprocessor removes such attributes before the Svelte compiler sees them.
