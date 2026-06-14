---
'svelte2tsx': minor
'svelte-check': minor
'svelte-language-server': minor
---

feat: add `customNamespaces` option to exempt custom namespaced attributes from prop/attribute type validation

Frameworks built on top of Svelte sometimes attach custom namespaced attributes to elements and components (e.g. `<Counter mochi:hydrate />`). These previously caused a `Type 'true' is not assignable to type 'never'` error. You can now list the namespaces to treat as opaque framework metadata via `customNamespaces` in `svelte.config.js`:

```js
// svelte.config.js
export default {
    customNamespaces: ['mochi']
};
```

An entry `'mochi'` matches an attribute named exactly `mochi` or any attribute starting with `mochi:`. Value expressions inside matched attributes are still type-checked. The option is honored by both `svelte-check` (CLI) and the language server (editor). `svelte2tsx` exposes the underlying `customNamespaces?: string[]` option directly.
