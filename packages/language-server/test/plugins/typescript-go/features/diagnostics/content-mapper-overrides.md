# Content mapper diagnostics: differences from TS6

`content-mapper.test.ts` compares what the user sees in content mapper mode (TS7's diagnostics after the editor middleware) with TS6's expectations. Where it differs, the fixture has an `expected_tsgo_content_mapper.json`. Each one is listed here with its reason (the test checks that).

`expected_tsgo.json` / `expected_tsgo_svelte_N.json` are differences that come from TS7 itself (messages, DOM types). They're shared with `svelte-check --tsgo` (`index.test.ts`) and aren't listed here.

## By design

-   `fixtures/parser-error`, `fixtures/svelte-element-error`: the Svelte plugin reports the compiler error, the middleware drops the mapper's duplicate. TS6 reported it as a TS diagnostic, too.
-   `fixtures/actions-animations-transitions-typechecks`: an element that doesn't fit a `transition:`/`use:` function is reported on the directive name, instead of TS6's empty range next to it.

## Not handled yet

-   `fixtures/$$props-usage`, `fixtures/invalid-import`: TS7 resolves imports of missing `.svelte` files through Svelte's ambient `declare module '*.svelte'`, which the TS6 language server blanks out. No 2307, so an `@ts-expect-error` above such an import is unused.
-   `fixtures/import-precedence`: TS7 resolves `./x.svelte` to the mapped `x.svelte` before `x.svelte.d.ts` / `x.d.svelte.ts`.
-   `fixtures/sveltekit-autotypings`, `fixtures/sveltekit-autotypings-arrow`: a content mapper can't rewrite SvelteKit's `.ts` route files, so `data` is `any`.
-   `fixtures/transition-options`: TS6 drops 2554 for transitions that require the third (`options`) parameter, using the checker.
-   `fixtures/reactive-statement-unused-in-comma-list/ignores-unused-let`, `fixtures/reactive-statement-unused-in-comma-list/keeps-legit-const`, `fixtures/reactive-statement-unused-in-comma-list/keeps-legit-import`: TS6 keeps 2695 for non-`let` names in `$:` (using the checker). The middleware drops all of them on `$:` lines, and none in `$: { … }` blocks.
