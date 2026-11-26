# Content mapper diagnostics: differences from TS6

`content-mapper.test.ts` compares what the user sees in content mapper mode (TS7's diagnostics after the editor middleware) with TS6's expectations. Where it differs, the fixture has an `expected_tsgo_content_mapper.json`. Each one is listed here with its reason (the test checks that).

`expected_tsgo.json` / `expected_tsgo_svelte_N.json` are differences that come from TS7 itself (messages, DOM types). They're shared with `svelte-check --tsgo` (`index.test.ts`) and aren't listed here.

## By design

-   `fixtures/parser-error`, `fixtures/svelte-element-error`: the Svelte plugin reports the compiler error, the middleware drops the mapper's duplicate. TS6 reported it as a TS diagnostic, too.
-   `fixtures/actions-animations-transitions-typechecks`: an element that doesn't fit a `transition:`/`use:` function is reported on the directive name, instead of TS6's empty range next to it.

## Need a TypeScript change or a mapper workaround

-   `fixtures/import-precedence`: TS7 resolves `./x.svelte` to the content-mapped `x.svelte` even when `x.svelte.d.ts` / `x.d.svelte.ts` exists next to it; TS6's language server preferred the declaration. That's TypeScript's resolver (the same code path as libraries that ship `.svelte` files with declarations). A fix in TypeScript would be the clean one, but it isn't strictly needed: the mapper could serve or forward to the sibling declaration (like the unmerged `6fe51282`, or the review's forwarding prototype); that workaround hasn't been selected.
-   `fixtures/sveltekit-autotypings`, `fixtures/sveltekit-autotypings-arrow`: `data` comes from the `load` function of `+page.ts`, which TS6's language server typed by rewriting the `.ts` file. A content mapper only transforms the files it's registered for (`.svelte`), so `data` is `any`.

## Matched only after post-processing

These fixtures match TS6 because the middleware adds what TS7 doesn't report. Plain `tsc` (and editors without the middleware) still differ; svelte-check needs the same post-processing.

-   `fixtures/$$props-usage`, `fixtures/invalid-import`: imports of missing `.svelte` files resolve to Svelte's ambient `declare module '*.svelte'` in TS7 (TS6 blanks it out). `unresolvedSvelteImports.ts` adds the 2307 and applies `@ts-ignore` / `@ts-expect-error` to it.
-   `fixtures/bindings`: svelte2tsx places the error of a `bind:` on a prop that isn't `$bindable()` on the directive (also for `tsc`), with TypeScript's message (`Type '"x"' is not assignable to type ...`); the middleware gives it TS6's message (`withNonBindableMessage`).

## Known differences without a fixture

Left as they are (uncommon, mostly Svelte 4 syntax); TS7 reports them differently from TS6 or doesn't report them:

-   Repeated event handlers on one element (`on:click={a} on:click={b}`): the repeated one is checked in its own `createElement` call, which doesn't have the element's other attributes (an element type with required attributes reports them missing), the event types an action adds, or the tag of `<svelte:element this={...}>` (the handler's parameter is implicitly `any`).
-   Transitions: for an overloaded transition function, the last overload decides whether svelte2tsx passes the third argument; a function that narrows the options type (`{ direction: 'in' }`) is an error under any directive, because svelte2tsx passes Svelte's declared `{ direction: 'in' | 'out' | 'both' }`.
-   Transitions without params (`<div in:fade />`) for a function that requires three parameters: TS7 reports "Expected 3 arguments, but got 2." (2554), which TS6 filtered.
-   `$:` comma lists: whether an operand is a `let` is decided by name against the component's top-level `let`s, so a block-local `let` in `$: { ... }` still gets 2695, and a block-local `const` that shadows a top-level `let` doesn't.
-   `$:` comma lists in parentheses or nested (`$: (a, b, update())`): TS7 reports 2695 for their operands, which TS6 filtered.
-   Template `<!-- @ts-ignore -->` / `<!-- @ts-expect-error -->` are line-based (see `fixtures/template-ts-directives.v5/README.md`): with two elements on the next line, they cover both.
