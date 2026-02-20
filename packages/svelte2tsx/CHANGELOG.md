# Changelog

## 0.7.50

### Patch Changes

-   fix: detect existing JSDoc @satisfies to prevent duplicate injection ([#2946](https://github.com/sveltejs/language-tools/pull/2946))

## 0.7.49

### Patch Changes

-   fix: handle relative imports reaching outside working directory when using `--incremental/--tsgo` flags ([#2942](https://github.com/sveltejs/language-tools/pull/2942))

-   fix: support SvelteKit zero types in svelte-check --incremental ([#2939](https://github.com/sveltejs/language-tools/pull/2939))

## 0.7.48

### Patch Changes

-   chore: add option to output pure jsdoc-based JS files ([#2932](https://github.com/sveltejs/language-tools/pull/2932))

## 0.7.47

### Patch Changes

-   fix: don't hoist type/snippet referencing $store ([#2926](https://github.com/sveltejs/language-tools/pull/2926))

## 0.7.46

### Patch Changes

-   fix: ensure await-block type is preserved in the latest Svelte version ([#2895](https://github.com/sveltejs/language-tools/pull/2895))

## 0.7.45

### Patch Changes

-   fix: allow `undefined` and `null` values for `#each` in Svelte 5 ([#2863](https://github.com/sveltejs/language-tools/pull/2863))

## 0.7.44

### Patch Changes

-   chore(deps): Replace `pascal-case` with `scule` ([#2842](https://github.com/sveltejs/language-tools/pull/2842))

-   fix: properly handle `runes={false}` in `<svelte:options>` ([#2847](https://github.com/sveltejs/language-tools/pull/2847))

## 0.7.43

### Patch Changes

-   fix: respect moduleResolution setting in emitDts ([#2845](https://github.com/sveltejs/language-tools/pull/2845))

See https://github.com/sveltejs/language-tools/releases for older release notes
