---
'svelte2tsx': minor
---

feat: allow augmenting Svelte components with custom namespaced attributes via `svelteHTML.ComponentAttributes`

Frameworks built on top of Svelte sometimes attach custom namespaced attributes to components (e.g. `<MyComponent mochi:defer />`). These previously caused type errors because the attribute is not part of the component's props. You can now declare such attributes globally — and have their values type-checked — by augmenting the `svelteHTML.ComponentAttributes` interface in a `d.ts` file (e.g. your `app.d.ts`):

```ts
declare namespace svelteHTML {
    interface ComponentAttributes {
        'mochi:defer'?: boolean;
        'mochi:hydrate:visible'?: { rootMargin?: string };
    }
}
```

With this in place, `<MyComponent mochi:defer mochi:hydrate:visible={{ rootMargin: '200px' }} someOtherProps="foo" />` type-checks: the namespaced attributes are validated against the declared types, while regular props keep being checked against the component's own prop definition. Only attribute names containing a `:` are treated as custom component attributes, and any namespaced attribute you don't declare is reported as an error so typos are caught.
