# Changelog

## 4.4.2

### Patch Changes

-   fix: resolve shims correctly in `--incremental/tsgo` mode ([`cd1ff2f`](https://github.com/sveltejs/language-tools/commit/cd1ff2f269f3401ad8a5924e208558de868a4f3c))

-   fix: include `references` in generated `tsconfig.json` in `--incremental/tsgo` mode ([`1990f74`](https://github.com/sveltejs/language-tools/commit/1990f7477de44740109e75a7755a92385c195374))

## 4.4.1

### Patch Changes

-   fix: handle relative imports reaching outside working directory when using `--incremental/--tsgo` flags ([#2942](https://github.com/sveltejs/language-tools/pull/2942))

-   fix: support SvelteKit zero types in svelte-check --incremental ([#2939](https://github.com/sveltejs/language-tools/pull/2939))

## 4.4.0

### Minor Changes

-   feat: provide `--incremental` and `--tsgo` flags ([#2932](https://github.com/sveltejs/language-tools/pull/2932))

### Patch Changes

-   fix: ignore Unix domain sockets in file watcher to prevent crashes ([#2931](https://github.com/sveltejs/language-tools/pull/2931))

-   fix: properly use machine output by default for Claude Code ([`e9f58d2`](https://github.com/sveltejs/language-tools/commit/e9f58d2379adf8dc4ea47b2fb3fad2797dd66f04))

## 4.3.6

### Patch Changes

-   fix: don't hoist type/snippet referencing $store ([#2926](https://github.com/sveltejs/language-tools/pull/2926))

## 4.3.5

### Patch Changes

-   fix: ensure await-block type is preserved in the latest Svelte version ([#2895](https://github.com/sveltejs/language-tools/pull/2895))

## 4.3.4

### Patch Changes

-   chore: use machine format when run by Claude Code ([#2870](https://github.com/sveltejs/language-tools/pull/2870))

## 4.3.3

### Patch Changes

-   fix: prevent file watcher issue ([#2859](https://github.com/sveltejs/language-tools/pull/2859))

-   fix: allow `undefined` and `null` values for `#each` in Svelte 5 ([#2863](https://github.com/sveltejs/language-tools/pull/2863))

-   perf: check if file content changed in tsconfig file watch ([#2859](https://github.com/sveltejs/language-tools/pull/2859))

## 4.3.2

### Patch Changes

-   perf: tweak some snapshot hot paths ([#2852](https://github.com/sveltejs/language-tools/pull/2852))

-   perf: more precise module cache invalidation ([#2853](https://github.com/sveltejs/language-tools/pull/2853))

-   fix: properly handle `runes={false}` in `<svelte:options>` ([#2847](https://github.com/sveltejs/language-tools/pull/2847))

See https://github.com/sveltejs/language-tools/releases
