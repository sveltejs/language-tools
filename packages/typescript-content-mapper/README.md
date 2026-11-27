# @sveltejs/ts-content-mapper

Type checks Svelte files with TypeScript 7.1+: a content mapper that turns `.svelte` files into TypeScript (with svelte2tsx) for `tsc`, svelte-check and editors.

## Setup

Install it next to `typescript` and `svelte`, and register it in your `tsconfig.json`:

```json
{
    "contentMappers": [{ "package": "@sveltejs/ts-content-mapper" }]
}
```

TypeScript takes the `extensions` (`.svelte`) from the mapper's package. `tsc` needs `--runExternalCode` to run content mappers.

## Which TypeScript parses the scripts

The mapper has no TypeScript of its own. It uses the first of:

1. `typescript` or `@typescript/native` at version 7.1 or later, resolved from the tsconfig's directory (its `node_modules` and the ones above it)
2. the same, resolved from the mapper's own location

Without one, every Svelte file gets an error that says which TypeScript was found: a project that stays on TypeScript 6 needs TypeScript 7.1 as `@typescript/native` next to it. A TypeScript installed elsewhere, e.g. in a sibling or nested directory of a monorepo, is not found; set `SVELTE_CONTENT_MAPPER_TYPESCRIPT` for that.
