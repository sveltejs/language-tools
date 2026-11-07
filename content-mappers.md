# Content mappers & TypeScript 7 support

Status notes for [#3111 "feat: typescript 7 content mapper"](https://github.com/sveltejs/language-tools/pull/3111) and the road to full TypeScript 7 (tsgo) support in the Svelte VS Code extension and svelte-check.

Sources:

-   the branch at `1d0aeaab` and the PR description/discussion
-   the TypeScript 7.1 nightly (`7.1.0-dev.20261103.1`). Its npm package ships the extension API and content-mapper types under `typescript/vscode` and `typescript/ast`.
-   the TS7 VS Code extension (`TypeScriptTeam.native-preview`, microsoft/TypeScript `packages/vscode-typescript`): first built from source at `bc4b3037a`, now the marketplace release 1.0.2 (Nov 6, built from `b37cbdc688`, which contains `bc4b3037a`). TS7 development has moved from `microsoft/typescript-go` into `microsoft/TypeScript`.
-   the LSP middleware POC (§2.5), verified in a real VS Code with the e2e harness (§2.6): 1.144.1 with the source build, 1.145.2 with the marketplace extension 1.0.2

Points marked _(verify)_ are inferences that have not been confirmed in a real VS Code window.

---

## 1. Background

### 1.1 How Svelte gets TypeScript support today (TS ≤ 6)

Everything is built on the **JavaScript compiler API** of the `typescript` package:

| Piece                                                                                   | What it does                                                                                                                                                                                                                                                                                                                                                                    | TS API used                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `svelte2tsx`                                                                            | Turns a `.svelte` file into virtual TS/JS (+ source map). Parses `<script>` contents with TS's parser and walks the AST heavily (~200 `ts.isXxx` call sites, `createScanner`, comment-range helpers).                                                                                                                                                                           | `ts.createSourceFile`, AST guards, scanner |
| language server, `TypeScriptPlugin` (`packages/language-server/src/plugins/typescript`) | Hosts an **in-process `ts.LanguageService`** over the virtual files. Every feature (completion, hover, diagnostics, rename, code actions, …) calls TS and then maps the results back through source maps. Adds a lot of Svelte-specific tweaks, such as filtering out false positives, store/`$$Props` handling, SvelteKit `$types` completions, and component/file references. | `LanguageService`, `Program`, checker      |
| `typescript-svelte-plugin` (`packages/typescript-plugin`)                               | A **tsserver plugin**. Makes `.svelte` imports in `.ts/.js` files resolve to real types (it patches the project host to serve svelte2tsx output), decorates rename/references/etc. so they work across `.svelte` files, and adds SvelteKit auto-typing (`+page.ts` load functions etc. via `upsertKitFile`).                                                                    | `tsserverlibrary`, plugin API              |
| `svelte-check`                                                                          | Reuses the language server's `SvelteCheck` class, i.e. the same in-process LanguageService.                                                                                                                                                                                                                                                                                     | same                                       |

### 1.2 Why this cannot work with TypeScript 7

TypeScript 7 is the Go port. As far as we're concerned:

-   **There is no in-process JS compiler API anymore.** The main export of `typescript@7` is only a version file (`lib/version.cjs`). There's no `LanguageService`, no `tsserverlibrary`, and no JS parser. The new JS API (`typescript/sync`, `typescript/async`) is an **IPC client** to a `tsc --api` process (or an experimental WASM build). It exposes compiler-level operations: programs/snapshots, checker queries, symbols, a JS-side AST, completions-at-position, references-for-node, and import edits. It is **not** a full language service: no quick-info display parts, code fixes/refactors, rename locations, formatting, and so on.
-   **There are no tsserver plugins.** With `js/ts.experimental.useTsgo` enabled, VS Code's JS/TS features come from the TS7 native LSP, which can't load `typescript-svelte-plugin`. `.svelte` imports in `.ts` files fall back to the ambient `declare module '*.svelte'`.
-   Re-implementing the Svelte LS's TypeScript features on top of the IPC API would mean rewriting most of TypeScript's language service in our code base. That isn't feasible, and it would be slow.
-   Even svelte2tsx is affected, because it needs a TS parser. TS 6 is the last JS version and won't learn TS 7.x syntax.

### 1.3 What content mappers are

Content mappers are a TypeScript **7.1** feature. They let TypeScript itself understand non-TS file types:

-   A project opts in via tsconfig:
    ```jsonc
    "contentMappers": [{ "package": "@sveltejs/ts-content-mapper", "extensions": [".svelte"], "options": {} }]
    ```
    Running external code must be allowed explicitly: `--runExternalCode` on the CLI, or the `runExternalCode` LSP init option, which the VS Code extension sets from `js/ts.contentMappers.enabled`.
-   TypeScript spawns the mapper process. The command comes from the package's `package.json`: `"typescript": { "contentMapper": { "exec": ["node", "dist/server.js"] } }`. TS talks to it over JSON-RPC on stdio:
    -   `initialize`: negotiates position encoding and the diagnostic source name.
    -   `openProject` / `closeProject`: tsconfig path, entry `options`, compiler options. Mappers that load their own config (like `svelte.config.js`) can declare `dynamicConfig` and return `configIdentity` + `watchedFiles`.
    -   `transform(fileName, content)`: returns virtual `text`, a virtual `extension` (`.ts`/`.js`/…), span `mappings`, parse `diagnostics`, `diagnosticDirectives` (for ts-ignore-like comments), and optional `supplemental` virtual files.
-   **Span mappings** are tuples `[virtualStart, virtualLength, originalStart, originalLength, kind, features?]`:
    -   `kind`: `Verbatim` (identical text, edit-safe), `Atom` (maps as a whole), or `Alias` (like `Atom`, but diagnostics show the original text).
    -   `features`: a bitmask over 20 LS features (Hover, Completion, Definition, Rename, InlayHints, SemanticTokens, Formatting, …). It controls which features may "see" that span. This is how generated code is hidden.
-   TypeScript then treats `.svelte` files as real modules: module resolution, type checking, emit (`.d.svelte.ts`), and all language features. That includes **inside `.ts` files** that import them, so rename/references/go-to-definition across `.ts`↔`.svelte` work natively. TS maps results back to the original file.
-   In the editor, TS7 dynamically registers LSP capabilities for `**/*.svelte`. Probing the 7.1 nightly with a full client showed it registers:
    -   document sync
    -   diagnostics, hover, signature help, definition, type definition, implementation, references
    -   document highlight, completion, rename, semantic tokens, document symbols, folding
    -   selection range, inlay hints, code lens, code actions
    -   formatting, range formatting, on-type formatting
    -   linked editing, call hierarchy
-   The TS7 VS Code extension API (`TypeScriptTeam.native-preview`) lets other extensions call `registerContentMappers(contributorId, [{ extensions, inferredProjectContribution? }])`. This tells TS7 which documents to sync and can provide a mapper for projects without a tsconfig entry. The 7.1 nightly's `typescript/vscode` types also describe the following, available since the extension's 1.0.2 release (not in 1.0.1):
    -   `onLanguageServerInitialized(sdk)`, where the SDK carries `version`, a module loader for `typescript/*` API modules, and `initializeAPIConnection`
    -   `registerLspMiddleware(method, transformer)`, which post-processes TS7's LSP responses before VS Code converts them (see §2.5)
-   TS7 only loads a mapper package whose (unresolved, symlink) path is **inside the open workspace**. Otherwise it reports "The content mapper package … is outside the open workspace and will not be loaded". In the LSP this diagnostic was not surfaced anywhere visible. The `.svelte` files then silently belong to no project. This affects monorepos with hoisted `node_modules` when only a sub-folder is opened.

**Why we need them:** content mappers are the only sanctioned way to make TS7 understand `.svelte` files. They replace _both_ the in-process TS6 LanguageService of the Svelte LS _and_ the tsserver plugin. TypeScript owns the TypeScript semantics, and we only provide the Svelte → TS transformation (svelte2tsx), which we already have.

---

## 2. State of the implementation (PR #3111)

### 2.1 What the PR already does

**New package `@sveltejs/ts-content-mapper`** (`packages/typescript-content-mapper/src/server.ts`)

-   A JSON-RPC stdio server implementing `initialize`, `openProject`, `closeProject` and `transform`.
-   It resolves `svelte/compiler` from the project, picks the Svelte 3/4/5 shims (`get_global_types`), and runs svelte2tsx with `generateSpanMapping: true`.
-   On transform failure it returns the script contents verbatim plus a diagnostic.

**svelte2tsx**

-   `src/utils/spanMap.ts`: derives span mappings from the magic-string source map. It merges consecutive identical characters into `Verbatim` runs and emits `Atom`s for the rest.
-   Per-node feature masks hide generated code. Examples: component names don't get semantic tokens or inlay hints, and generated `props`/`mapElementTag` code is mapped with no features at all (no hover, no inlay hints, no references, …). There are extra anchors (e.g. the default export → offset 0 for go-to-definition).
-   Content-mapper-specific output tweaks: no `$$_$$` dummy params, and `// @ts-check`/`// @ts-nocheck` are hoisted to the top (`directiveComment.ts`).
-   Shared improvements that also affect the TS6 path: import grouping/moving, ignoring `<script>` tags nested in the template (`extractScriptTags`), and `parseTemplateOnly`.

**Language server** — "content mapper mode" (`server.ts`, `enableTs6Features === false`)

-   `TypeScriptPlugin` isn't registered at all.
-   TS-only capabilities are turned off: semantic tokens, signature help, inlay hints, call hierarchy, implementation, type definition, workspace symbols, and linked editing.
-   Svelte, HTML and CSS features stay: compiler diagnostics, Svelte/HTML/CSS completions & hover, Prettier formatting, colors, tag close, compiled-code preview, the extract-component and migrate-to-Svelte-5 commands, and the runes-mode code lens.
-   Svelte block folding was extracted from the TS folding provider (`getSvelteBlockFolding.ts`) and is now served by `SveltePlugin`. It uses a template-only parse (`TemplateASTLoader.ts`).
-   Mode detection (`plugins/typescript-go/content-mapper.ts`) works like this: the client says TS7 can take content mappers, and some tsconfig in the workspace has a `contentMappers` entry for `.svelte`. The server then reports `customServerStatus.experimental.contentMapperModeEnabled` back to the client.

**VS Code extension** (`packages/svelte-vscode/src/typescript-go/contentMapper.ts`, `extension.ts`)

-   If `useTsgo` is explicitly on and the TS7 extension exposes `registerContentMappers`, the extension registers `.svelte`.
-   It disables `typescript-svelte-plugin`.
-   It disables the TS6-only client features: find file/component references (and their menus), rename-file import updates, and `$/onDidChangeTsOrJsFile`.
-   It restarts the LS when the relevant settings change.

**Tests**

-   TS7 LSP-driven feature tests under `packages/language-server/test/plugins/typescript-go/features/` cover definition, references, hover, implementation, selection range, semantic tokens, type definition and document highlight.
-   They spawn the real `tsgo --lsp` with the mapper and mostly reuse the TS6 test bodies, with documented differences and skips.
-   The content-mapper diagnostics suite is `describe.skip`, meant to be run manually.

### 2.2 Ownership in content mapper mode

```
                 ┌──────────────────────────── VS Code ─────────────────────────────┐
 .svelte file ──►│ Svelte LS (Svelte/HTML/CSS)        TS7 LSP (TS semantics)          │
                 │  - compiler diagnostics             - TS diagnostics, hover, defs  │
                 │  - Svelte/HTML/CSS completions      - TS completions, rename, refs │
                 │  - Prettier formatting              - code actions, inlay hints    │
                 │  - block folding, colors            - semantic tokens, ...         │
                 └──────────────────────────────────────────────│────────────────────┘
                                                                 │ JSON-RPC (stdio)
                                                      @sveltejs/ts-content-mapper
                                                      └─ svelte2tsx (+ TS6 parser)
```

Two servers now serve the same document, and VS Code combines them per feature:

-   **Merged:** completions, hovers, definitions/references, code actions, code lenses, inlay hints, symbols, folding. Diagnostics come from separate collections.
-   **Single provider:** document highlights, semantic tokens, formatting, rename, linked editing. Only one provider is used.

This is the root of several issues below.

Details checked in VS Code 1.144's source and the e2e harness:

-   **Document highlight, single-file mode** (default): providers are asked in score order, and the first non-`null` result wins. The Svelte client (`language: 'svelte'`) scores above TS7 (`pattern: '**/*.svelte'`), so the Svelte LS is asked first. TS7 is only asked when the Svelte LS returns `null`. (`PluginHost` falls back to `null`, not `[]`: its `?? []` is applied to a Promise and never kicks in.)
-   **Document highlight, `editor.occurrencesHighlight: "multiFile"`:** _only_ multi-document providers are used. Only TS7 registers one (`custom/textDocument/multiDocumentHighlight`), so Svelte/HTML/CSS highlights disappear unless the middleware merges them.
-   `editor.occurrencesHighlightFromAllProviders` (off by default) makes VS Code merge all single-file providers itself.

### 2.3 Open work to make the VS Code extension work with tsgo

#### A. Robustness, onboarding, mode selection

1. **Silent total failure when the TS7 server doesn't support mappers.** If TS7 runs 7.0.x, the extension still sees `registerContentMappers` (a client-side API) and switches the Svelte LS into mapper mode. The server rejects `custom/setContentMapperContributions` (only logged in the "TypeScript 7" output). The result is **no TypeScript features at all** in Svelte files.
    - This happens with `native-preview` 1.0.1 + `vscode-typescript-nightly` 0.20261102.x: the nightly moved its binary to `node_modules/@typescript/typescript-<platform>/lib/tsc`, and native-preview 1.0.1 only looks at `<ext>/lib/tsc`, so it falls back to its bundled 7.0.2. 1.0.2 looks for the platform package next to `node_modules/typescript`, so it should find the nightly _(verify)_. It still bundles 7.0.2 as the fallback, but it passes `sdk.version` (see below).
    - Detection is possible:
        - Newer TS7 extensions pass `sdk.version` to `onLanguageServerInitialized`.
        - With older ones, we can probe whether any semantic-tokens provider exists for an open `.svelte` doc (`vscode.provideDocumentSemanticTokensLegend`). The Svelte LS has none in mapper mode, so a provider means TS7 is serving the file.
    - On failure: warn, or fall back to TS6 mode.
2. **Mode is decided workspace-wide from a text scan.** `contentMapperEnableCheck` returns true if _any_ tsconfig maps `.svelte`. That turns off TS6 for _every_ Svelte file, including other workspace folders and projects without a mapper (where TS7 returns nothing).
    - The scan also uses TS6's config parser and reads `raw.contentMappers`, so it misses:
        - mapper entries inherited via `extends`. This matters, e.g., if SvelteKit's generated `$app/tsconfig` ever adds the entry.
        - project references / `tsconfig.app.json`
        - dot-directories
    - It crashes LS initialization on malformed entries (`"contentMappers": [{}]`).
    - Better: ask TS7 authoritatively and decide **per project/document**. Options are the API connection (`parseConfigFile`, `getDefaultProjectForFile`), or a project-info API exposed by the TS7 extension (its client has `custom/projectInfo`, but it isn't exported).
3. **No hint when the config is missing.** With `useTsgo` on but no `contentMappers` in tsconfig, `.svelte` imports in `.ts` files silently degrade to the ambient module type. We need a diagnostic/notification with a quick fix that adds the entry and installs the package.
4. **Onboarding.** Users must install `@sveltejs/ts-content-mapper` in every project _and_ edit tsconfig.
    - `inferredProjectContribution` (mapper shipped inside the extension) is commented out on purpose: enabling it would force mapper mode everywhere.
    - Possible directions: SvelteKit puts the entry into its generated tsconfig, `sv`/`create-svelte` templates add it, or TS7 gets a "contribute to configured projects" mode.
5. **Lifecycle bugs.**
    - ~~The `Disposable` returned by `registerContentMappers` is never stored.~~ Fixed in `1d0aeaab`: registrations are kept in `contentMapperDisposables` and disposed when the setting is turned off.
    - ~~The SDK version gate `(major === 7 || minor < 1)` disabled mapper mode for every 7.x server~~ as soon as the TS7 extension passes `sdk.version`. Fixed in the middleware POC: `major < 7 || (major === 7 && minor < 1)`.
    - Changes to `tsconfig.json` don't re-evaluate the mode (tsconfig is commented out of the restart-on-save list; `svelte.config.*` saves do restart).
6. **`node` must be on the TS7 server's `PATH`.** The mapper manifest is `exec: ["node", "dist/server.js"]`. GUI-launched VS Code on macOS or nvm/fnm setups can break this.
7. **Other editors.** Mapper mode is enabled through VS Code-specific init options (`tsGoContentMapperOptions`). For Neovim/Zed/etc., the content mapper works with any TS7 LSP, but the Svelte LS needs a documented way to switch into mapper mode, or it must auto-detect.

#### B. Feature gaps & regressions compared with TS6 mode

Status after the middleware POC (§2.5). ✅ = fixed there, verified in VS Code by the e2e harness.

| Area                              | Status in mapper mode                                                                                                                                                                                                                                                                                                                                                                                    | Fix direction                                                                                                                                                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document highlight                | ✅ Svelte block/tag keyword highlights had been lost entirely, because they lived in the TS6 `DocumentHighlightProvider`. TS7 returns `[]` for `{#if}`/`{/each}`/`{@html}` and only highlights the start tag for HTML elements.                                                                                                                                                                          | Done: moved to `SveltePlugin` (template-only AST). The highlight middleware makes this independent of provider order and covers `multiFile` mode (§2.2).                                                                                                                                      |
| Completions                       | ✅ ~46 generated names per request (`__sveltets_2_*`, `$$render`, `X__SvelteComponent_`, `svelteHTML`, …).                                                                                                                                                                                                                                                                                               | Done: middleware filter. Longer term: hide shim declarations via TS (span masks don't cover global declarations).                                                                                                                                                                             |
| Component tag names               | ✅ After typing `<`, components only showed up at the second character (`<Ch`), see §2.5. Auto-imports of components were named `Child__SvelteComponent_` (label, inserted name and import), and were dropped by the generated-names filter.                                                                                                                                                             | Done: middleware (§2.5). Remaining: TS7 offers **no auto-imports at all** in `.svelte` files that already have an import, and none at the end of a template identifier (see §2.5). Needs a svelte2tsx/mapper fix.                                                                             |
| Signature help                    | ✅ Shows generated wrappers: `__sveltets_2_ensureArray(...)` inside `{#each [..]}`, `$$_xyz(options: ComponentConstructorOptions<$$ComponentProps>)` inside component props.                                                                                                                                                                                                                             | Done: middleware filter. Better: mask `SignatureHelp` on those svelte2tsx spans.                                                                                                                                                                                                              |
| Hover                             | ✅ Component tags show `(alias) const Child__SvelteComponent_: Component<$$ComponentProps, …>`.                                                                                                                                                                                                                                                                                                          | Done: middleware rewrites `X__SvelteComponent_` → `X` (also in diagnostic messages) and drops hovers of generated declarations. `$$ComponentProps` stays; renaming it would need type info.                                                                                                   |
| Inlay hints                       | ✅ Duplicated when a node is split into several spans: `{add(item, index)}` inside `{#each}` got each hint three times (7 of 23 hints in the fixture).                                                                                                                                                                                                                                                   | Done: middleware dedupe. Upstream fix / fewer splits in svelte2tsx still worthwhile.                                                                                                                                                                                                          |
| Definitions / references          | No svelte2tsx shim locations leaked in any probe; the span masks already hide them. The middleware filter for shim files + dedupe is only a guard. TS7 alone treats `store`/`$store` as unrelated (rename breaks code, definition of `$store` empty). Still missing: `transition:fade`/`$$props` definitions.                                                                                            | ✅ `$store` handling in the Svelte LS with the TS7 API (rename, references, definition/implementation), see §2.5 "`$store` ↔ `store`". (Not via svelte2tsx output: the per-usage `(__get(store), $store)` transformation was removed in #1531 because of edge cases and an upstream TS bug.) |
| Document symbols                  | TS7 returns no symbols for `.svelte` files, so the outline loses the script contents (TS6 showed them).                                                                                                                                                                                                                                                                                                  | Find out why (span masks? `DocumentSymbol` feature bit?).                                                                                                                                                                                                                                     |
| SvelteKit auto-typing             | Lost for `.ts`/`.js` route files (`+page.ts` load functions, actions, `+server.ts`, hooks, params). The mapper only handles `.svelte`; TS7 reads `.ts` directly, so `upsertKitFile` never runs. Kit export completions/hover/diagnostics from the tsserver plugin are gone too, as is the `./$types` import completion rewrite. `.svelte` route props typing still works (filename-based in svelte2tsx). | Needs either a TS mechanism to transform `.ts` files, or SvelteKit moving away from implicit typing (explicit annotations / codemod). **Open question.**                                                                                                                                      |
| Find component / file references  | Component references (command, menus, references from the script tag, references code lens) are back via the TS7 API connection (#3183, §2.5 "API connection"). File references and their menus are still hidden.                                                                                                                                                                                        | File references: same approach (`getReferencedSymbolsForNode` on the module).                                                                                                                                                                                                                 |
| Svelte-specific TS-aware features | Lost: component-event hover, custom-element hover (tests skipped), Svelte-specific TS quick fixes/refactors in `CodeActionsProvider`, HTML-vs-TS completion de-duplication (`PluginHost`).                                                                                                                                                                                                               | Middleware (filtering/merging) + API connection (anything that needs types).                                                                                                                                                                                                                  |
| HTML tag linked editing           | Regressed: `linkedEditingRangeProvider` is switched off together with the TS features, but it also drove HTML open/close tag editing. TS7 registers linked editing for `.svelte` too, and only one provider wins.                                                                                                                                                                                        | Keep it on in the Svelte LS, mask linked editing in spans. **Not fixable by middleware**: it can't unregister TS7's provider.                                                                                                                                                                 |
| Formatting                        | TS7 registers formatting/range/on-type formatting for `**/*.svelte`. Verbatim script spans carry the default "all features" mask, so VS Code likely sees two formatters for Svelte files _(verify)_.                                                                                                                                                                                                     | Mask `Formatting` in svelte2tsx spans, or ask TS for an opt-out. Not fixable by middleware (returning `[]` keeps the registration).                                                                                                                                                           |
| Folding / selection range         | Both servers provide them. TS7's folding includes ranges for template blocks that overlap the Svelte LS's block folding; VS Code merges them (same start lines are deduped) _(verify visually)_.                                                                                                                                                                                                         | Feature masks or middleware.                                                                                                                                                                                                                                                                  |
| Rename file → update imports      | Svelte LS listener is disabled. TS7 has a `content-mapper-will-rename-files` registration, so it probably handles this natively _(verify)_.                                                                                                                                                                                                                                                              | Verify; drop our implementation.                                                                                                                                                                                                                                                              |
| Svelte 4 legacy features          | Some are unmappable, so generated-code diagnostics can't be filtered.                                                                                                                                                                                                                                                                                                                                    | Accept, or drop Svelte 4 from the TS7 path.                                                                                                                                                                                                                                                   |

#### C. Mapping & diagnostics correctness

-   **Diagnostics filtering parity.** The TS6 path post-processes diagnostics heavily (`mapAndFilterDiagnostics`, `isNoFalsePositive`, `$$Props`/store/transition fix-ups, dropping errors in generated code). With mappers, TS7 maps diagnostics itself.

    -   Diagnostics in unmapped virtual code are **reported, not dropped**. In the editor, TS7 bundles all of them into **one** diagnostic, code 18080 ("Virtual code produced by the content mapper … has problems with no corresponding location in this file"), at 0:0. The individual problems become its `relatedInformation`, located at 0:0 and **without error codes**. The CLI shows similar errors on `@lucide/svelte` components.
    -   The fix has to come from three places: svelte2tsx output that never errors in generated code, span feature masks / `diagnosticDirectives`, and the `textDocument/diagnostic` middleware for the rest.
    -   Middleware status (§2.5):

        | TS6 rule                                                                                  | Mapper mode                                                                                                                                                                                                                                                                                                               |
        | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
        | unused `$:` label (7028)                                                                  | ✅ ported (text-based)                                                                                                                                                                                                                                                                                                    |
        | comma noop in `$:` (2695)                                                                 | ✅ ported, but drops all of them: TS6 kept those for non-`let` identifiers, which needs the checker                                                                                                                                                                                                                       |
        | `bind:` on non-bindable prop (`$$bindings`, `moveBindingErrorMessage`)                    | ✅ placed with the TS7 API: the error's virtual position is the `$$bindings` access, the component is the `__sveltets_2_ensureComponent(X)` argument of the same block (mapped to the tag name), so it lands on the exact `bind:` directive. Locale-independent, no ambiguity when several components bind the same name. |
        | `$$_` deprecation (6387), `ConstructorOfATypedSvelteComponent` / 1184 message hints       | ✅ ported. Deprecations in unmapped virtual code (inside 18080) are dropped with the TS7 API, see below.                                                                                                                                                                                                                  |
        | svelte2tsx parse failure (`parserError`: TS6 only reported the parse error)               | ✅ the mapper's parse error (source `svelte`) duplicates the Svelte compiler's diagnostic → dropped. "Unused" hints are dropped as well, because the template is unknown.                                                                                                                                                 |
        | duplicates from split spans                                                               | ✅ dedupe                                                                                                                                                                                                                                                                                                                 |
        | store misuse ("Cannot use 'x' as a store", needs `findReferences`)                        | ✅ placed with the TS7 API at every `$x` usage (the error sits on the argument of the hidden `__sveltets_2_store_get(x)`), with TS6's message                                                                                                                                                                             |
        | `$$Props` range remapping, transition third argument, used-before-assigned for props, pug | ❌ need virtual code / checker; not reproduced in TS7 yet except the store case                                                                                                                                                                                                                                           |

    -   How the API placement works (`middleware/virtualCodeDiagnostics.ts`): only when TS7's report contains an 18080, the LS asks the API for the file's syntactic/semantic/suggestion diagnostics. The ones in unmapped virtual code carry a message-chain entry with code 18074 ("This location is in virtual code …"), and their positions are virtual offsets (mapped ones come in original positions). Relocated problems replace their 18080 related-information entries. Deprecations of the code svelte2tsx generates for class components (`new $$_…C(...)` and `$$_….$on(...)`, recognized by the AST at their virtual position) are dropped. 18080 is dropped once every unmapped problem is placed or dropped. Skipped if TS7's snapshot text differs from the LS document.
    -   A svelte2tsx fix (mapping the `$$bindings` access to the `bind:` directive and the store accesses to the `$store` usages) would still be cleaner: TS7 would then report them at real locations, also in the CLI.

-   **Config parity in the mapper.** The mapper ignores `svelte.config.js`: `compilerOptions.namespace`, `accessors`/`customElement`, `kit.files.*`, and tsconfig `svelteOptions`. It doesn't implement `dynamicConfig`/`configIdentity`/`watchedFiles`, so config changes wouldn't be picked up either.
-   **Script language detection.** Only `lang="ts|typescript"` counts. The LS also accepts `type="text/typescript"`.
-   **`const` type parameters.** `generics="const T …"` is copied onto a type alias, which gives TS1277. This was hidden before because it couldn't be mapped.
-   **Determinism.** `shimPaths.reverse()` mutates the cached array, so reference order flips between transforms.
-   **Span invariants.** There should be assertions that `Verbatim` spans really are identical text and that spans are ordered and non-overlapping. TS7 rejects bad maps with error 100037. An earlier cross-line offset bug of this kind has since been fixed.

#### D. Library resolution (`.svelte` next to declarations)

With a mapper, TS treats `.svelte` like a `.ts` source file, so it prefers `node_modules/lib/dist/Foo.svelte` over the `Foo.svelte.d.ts`/`Foo.d.svelte.ts` next to it (reproduced with the 7.1 nightly CLI for both names). Library sources are then type-checked: 124 errors in layerchart/bits-ui in one report, plus slower checks. Users also get the types of the sources instead of the published declarations. Export maps don't help for relative imports inside barrels (`index.d.ts` → `export { default as Foo } from './Foo.svelte'`).

Agreed direction from the discussion:

-   `@sveltejs/package` emits `.d.svelte.ts`, not `.svelte.d.ts`, and puts declarations in a separate folder from the `.svelte` sources.
-   For libraries that don't republish, candidate workarounds were:
    -   TS content-mapper file globs ([microsoft/TypeScript#64362](https://github.com/microsoft/TypeScript/issues/64362)), so `node_modules` can be excluded
    -   the mapper returning a re-export of the sibling declaration for `node_modules` files

✅ **Workaround in the mapper** (`loadLibraryDeclaration` in `typescript-content-mapper/src/server.ts`), a variant of the second option: for a `.svelte` file in `node_modules` with a sibling `Foo.d.svelte.ts` (preferred) or `Foo.svelte.d.ts`, `transform` returns the text of that declaration file instead of the svelte2tsx output. Without a sibling declaration, the file is transformed with svelte2tsx as before.

-   TS7 has no `.d.ts` virtual extension (`IsSupportedVirtualExtension` only allows `.js`/`.ts`/… and `.json`), so the text is returned as `.ts`. It's parsed in a non-ambient context, because `isDeclarationFile` comes from the original file name.
-   Declaration-only syntax is then an error. Svelte 4 accessors (`get name(): string;`) give TS1005 "'{' expected". The mapper therefore prepends `// @ts-nocheck`, which TS7 honours in `.ts` files too (`SkipTypeChecking` → `CheckJsDirective`). In effect, these files always skip lib checks, whatever `skipLibCheck` says.
-   Mappings: one `Atom` from the whole text to original `[0, 0]`, with only the `Definition`, `TypeDefinition` and `Implementation` features. TS7 drops definitions whose name isn't mapped (`ls/definition.go`), so with `mappings: []` go to definition on a library component returns nothing. With the atom it lands at the top of `Foo.svelte`, like the svelte2tsx default-export anchor.
-   Tests: `language-server/test/plugins/typescript-go/library-declarations/`. The fixture library has a `.svelte.d.ts`, a `.d.svelte.ts` and a component without declarations. The tests check diagnostics of the consumer (`@ts-expect-error` where declarations and sources disagree) and of the library files, plus go to definition. The diagnostics tests fail with the previous mapper, the definition tests with `mappings: []`.
-   Limitations:
    -   TS7 doesn't know that the output depends on the declaration file. If only the declaration changes, the old output stays until `Foo.svelte` is transformed again. A reinstall usually changes both.
    -   Only paths with a `node_modules` segment count. Workspace packages linked into `node_modules` resolve to their real path, so they are still transformed from source.
    -   A library `.svelte` file opened in the editor gets no TS features, because nothing in it is mapped apart from the navigation anchor.
    -   Libraries without declarations next to their `.svelte` files are still type-checked from source.
-   Side effect: class-style declarations, as libraries built for Svelte 4 ship them, now type those components in Svelte 5 projects too. For `<Foo />`, svelte2tsx then generates `new $$_…C(...)` and `$$_….$on(...)`, and Svelte 5 deprecates both. That code is unmapped, so TS7 reports the deprecations as an 18080 hint at the start of the file. Before, these components were transformed from source and their constructor wasn't deprecated. The middleware drops these deprecations (§2.3 C). They remain where it doesn't run: other editors, and TS7 extensions without `registerLspMiddleware`. For this reason the consumer in the test fixture has no template.

The real fix stays on the publishing side (first bullet). The workaround can go once libraries ship declarations in a separate folder, or once #64362 allows excluding `node_modules`.

### 2.4 Hurdles (waiting on TypeScript)

| Dependency                                                                           | Why it matters                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TS 7.1 stable** with content mappers, **bundled with the TS7 VS Code extension**   | The extension side is released: `native-preview` 1.0.2 (Nov 6) has everything the PR and the middleware use. But it bundles TS 7.0.2, so users still need a 7.1 nightly server (`js/ts.tsdk.path` or the nightly extension).                                                                                                                                                                                                                                                                                                                                              |
| **`registerLspMiddleware`** in a released TS7 extension                              | ✅ Released in `native-preview` 1.0.2 (Nov 6, microsoft/TypeScript#64583). 1.0.1 doesn't have it, so the Svelte extension checks for it. Needed for everything in §2.5. Limitations: see §2.5.                                                                                                                                                                                                                                                                                                                                                                            |
| **`onLanguageServerInitialized(sdk)`** with version + module loader + API connection | Needed to detect server capabilities reliably, and to run Svelte-specific semantic queries against the _same_ TS7 project the LSP uses (`API.fromLSPConnection`, `getCurrentLanguageServerSnapshot`). ✅ Released in 1.0.2 as well.                                                                                                                                                                                                                                                                                                                                       |
| Upstream bugs                                                                        | Duplicate inlay hints for split nodes (worked around by middleware). The auto-import formatting panic was already fixed in microsoft/TypeScript#64042. `vscode.executeSignatureHelpProvider` without a trigger character sends `triggerCharacter: null`, which TS7 rejects with InvalidParams. Trigger characters are validated against the virtual code, so typing `<` before a component name never gets completions in content-mapped files (§2.5, worked around by middleware). The "mapper package outside the workspace" error isn't surfaced in the editor (§1.3). |
| Content-mapper scoping globs (#64362)                                                | Library resolution. No longer blocking: the mapper serves the declarations next to `node_modules` `.svelte` files itself (§2.3 D). Globs would make that workaround unnecessary.                                                                                                                                                                                                                                                                                                                                                                                          |
| A story for transforming `.ts` files                                                 | Needed for SvelteKit implicit typing. Unclear whether TS will ever allow it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| API stability                                                                        | The `typescript/sync` API changed between 7.0 and 7.1 (`/unstable/*` → `/sync`). svelte-check carries date-based version gates.                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### 2.5 LSP middleware (POC)

**How the TS7 side works** (`packages/vscode-typescript/src/lspMiddleware.ts`):

-   `registerLspMiddleware(method, transformer)` hooks into vscode-languageclient's `sendRequest` middleware.
-   Each transformer gets a `structuredClone` of TS7's result and `context.params`, a deep-readonly copy of the request params.
-   Transformers run in registration order. If one throws, the error is logged ("LSP middleware for '…' failed; using original server data") and the original response is used.
-   Registrations survive server restarts.
-   Supported methods:
    -   hover, completion (+ resolve), signature help
    -   definition/typeDefinition/implementation/references
    -   (multi-document) highlight, document/workspace symbols
    -   rename (+ prepare), the three formatting methods
    -   selection range, folding, inlay hints, code action, code lens (+ resolve)
    -   call hierarchy, linked editing, semantic tokens
    -   pull diagnostics, source definition

**Svelte side:**

-   `packages/svelte-vscode/src/typescript-go/middleware/` registers if the API has `registerLspMiddleware`. It only touches `.svelte` URIs, and only while the Svelte LS runs in content mapper mode.
-   **Forwarded** methods send `$/transformTsgoResponse { method, params, result }` to the Svelte LS, with a timeout after which TS7's response is used as is.
    -   The logic lives in `packages/language-server/src/plugins/typescript-go/middleware/`. It doesn't import TS, has access to the document, the template AST and the Svelte/HTML/CSS plugins, and can be reused by other clients. The diagnostics part can also be reused by svelte-check (§3.3).
    -   A round trip costs ~1 ms for highlights.
-   **Local:** completions are filtered in the extension. A response has ~1100 items / ~200 KB, and forwarding it measured ~4–5 ms per request.
-   **Component tag names** (`completionsHost.ts`, `componentTagText.ts`):
    -   _Problem:_ after typing `<`, TS7 returns nothing. VS Code only asks a provider again while the user types if its last list was `isIncomplete` **and non-empty**. So TS7 wasn't asked at `<C` anymore. VS Code kept filtering the HTML tag list, and components only showed up once nothing matched any more (`<Ch`), when VS Code started a new session.
    -   _Root cause: TS7 decides not to answer the `<` trigger._ The request typed `<` carries `triggerCharacter: "<"`. TS7 validates trigger characters against the **virtual** code (`isValidTrigger` in `tsc/internal/ls/completions.go`). `<` is only accepted if the token before the cursor is a `<` that may open a JSX tag. In svelte2tsx output the token before a tag name is `(` (`__sveltets_2_ensureComponent(`), and a `<` in `.ts` output would be a type assertion. So the request is rejected even when the position is mapped perfectly. Measured on `<C` at the position after `<`: a manual request (Ctrl+Space) returns 1117 items including `Child`; the same position with `triggerCharacter: "<"` returns `null`.
        -   Better svelte2tsx output for a bare `<` (currently the template doesn't parse, and the mapper falls back to the script only) would therefore only fix Ctrl+Space, not typing.
        -   A fallback mapping must be exact (TS7 returns nothing for positions without an exact mapping), so it doesn't help either.
        -   The middleware can't change the request: it only sees responses, and the params are read-only.
    -   _Upstream ask:_ in content-mapped files, validate trigger characters against the original text (it does have `<` before the cursor), or let a mapper declare which trigger characters it accepts. Once that's done, the extra request, the incomplete-list trick and the cache below can be removed (marked `REMOVE WHEN` in `completions.ts`). Filtering to components, the generated-name filter, the auto-import rename and the template auto-imports stay.
    -   _Fix:_ at a tag-name position in the markup (text check: after `<`/`<Name`, outside script/style/`{…}`/comments), the middleware asks TS7 again at the start of the instance script, through `vscode.executeCompletionItemProvider`. While that runs, its own middleware call captures TS7's raw items, because the `data` they carry is needed for resolve.
        -   At `<`, it returns those components (uppercase names, no globals/interfaces/enums) as an `isIncomplete` list, so VS Code asks TS7 again at `<C`.
        -   At `<C`, it keeps only components and adds component auto-imports from the script position.
        -   The script results are cached per script text. The extra request costs 150–300 ms (~1800 items through VS Code's command layer, 50 ms in TS7).
    -   _Auto-imports:_ TS7 drops every auto-import whose import edit can't be mapped back exactly. Measured with `lsp-dump`:
        -   no auto-imports at any position in `.svelte` files that already have an import
        -   none at the end of a template identifier (`{mou|}`, `<Child|`), i.e. where the cursor usually is; inside it (`<Chi|ld`) they do come
        -   ~690 in the script of files without imports
        -   ~690 while the template doesn't parse (the mapper then emits only the script)
    -   _Import placement:_ TS7 maps the import edit back from the virtual code, which goes wrong without a usable script. With no script, the import was inserted after the first `<` of the file (`<\nimport …\n\nChild`). With `<script></script>`, it landed after `</script>`. Like TS6 (`codeActionChangeToTextEdit`), `importEdits.ts` moves import edits that aren't inside a script to the start of the instance (else module) script. If there is no script, it creates one (`svelte.plugin.svelte.defaultScriptLanguage` decides on `lang`). This applies to completion items and to `completionItem/resolve`.
    -   _Resolve:_ `completionItem/resolve` gets our renamed item (`Child`) and returns that label, but recomputes the import edit with the generated name (`import Child__SvelteComponent_ …`). The rename therefore keys on `data.autoImport.name`, not the label.
    -   _No usable script_ (none, or `<script></script>`, where nothing is mapped): the script request isn't possible or returns `null`. At `<Name|`, the middleware then asks TS7 one character to the left, inside the name, where TS7 does offer auto-imports. At `<` alone in such files there is still nothing to ask, so typing `<` there keeps the old behavior (components from the second character).
    -   Thanks to the cache, auto-imports found at `<` are still offered at `<Di`. Typing `<Di` without typing `<` first in a file with imports still gives no auto-imports. A real fix is likely in the span mappings around svelte2tsx's hoisted imports (the end of the import span is followed by generated code that is mapped as an atom). _(verify)_
-   In mapper mode with middleware, the Svelte client's own highlight provider returns `null` and defers to TS7, where both results are merged.

| Method                                                                               | Transformation                                                                                                                                                                                             | Where                                                            |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `textDocument/diagnostic`                                                            | rules from §2.3 C, 18080 contents placed via the TS7 API, `X__SvelteComponent_` → `X` in messages                                                                                                          | LS, 3 s                                                          |
| `textDocument/documentHighlight`, `custom/textDocument/multiDocumentHighlight`       | Svelte/HTML/CSS highlights win, TS7 otherwise (TS6 precedence)                                                                                                                                             | LS, 500 ms                                                       |
| `textDocument/completion`, `completionItem/resolve`                                  | drop generated names; rename component auto-imports (`X__SvelteComponent_` → `X`, also in `.ts` files); at a template tag name: components only, plus an extra TS7 request at the script start (see below) | extension                                                        |
| `textDocument/signatureHelp`                                                         | drop generated signatures (`__sveltets_*`, `$$_*`), fix `activeSignature`                                                                                                                                  | LS, 500 ms                                                       |
| `textDocument/hover`                                                                 | `X__SvelteComponent_` → `X`; drop hovers of generated declarations                                                                                                                                         | LS, 500 ms                                                       |
| `textDocument/inlayHint`                                                             | dedupe by position + label + kind                                                                                                                                                                          | LS, 1 s                                                          |
| `textDocument/definition`, `typeDefinition`, `implementation`, `references`          | drop svelte2tsx shim locations, dedupe                                                                                                                                                                     | LS, 1 s (references 2 s)                                         |
| `textDocument/prepareRename`, `rename`, `references`, `definition`, `implementation` | `$store` ↔ `store` with the TS7 API, see below. References and rename are also forwarded for non-Svelte files when their result touches a `.svelte` file.                                                 | LS (rename 2 s); extension only for renames starting at `$store` |

**Limitations and hurdles found while building it:**

1. **Needs TS7 extension 1.0.2 or newer** (released Nov 6). Older extensions must keep working without it; we check for `registerLspMiddleware`.
2. **Responses only.** The middleware can't:
    - send additional TS7 LSP requests. Semantic queries go through the API connection now (see "API connection" below); LSP-only features such as rename still need `vscode.execute*Provider`
    - change request params
    - add or remove capability registrations: formatting, linked editing and semantic tokens can't be "turned off", because returning `null`/`[]` still leaves TS7's provider registered
    - see notifications: pushed diagnostics (TS7 pushes tsconfig diagnostics), progress
    - see partial results or `workspace/diagnostic`
3. **No cancellation.** The transformer gets no cancellation token, and TS7's request awaits it. A busy Svelte LS (single-threaded, e.g. while compiling) delays TypeScript features up to the timeout. Our forwarded request is cancelled when the timeout fires.
4. **Original positions only** in the LSP responses. The 18080 aggregate has no codes and no positions. Resolved for the Svelte LS by the API connection: it sees the virtual code, the span map and the checker, so the `$store` features and the 18080 relocations use those instead of message text (locale-independent). Rules that need the svelte2tsx output can be ported the same way.
5. **Copies.** Every transformer gets a `structuredClone`, and forwarding adds JSON serialization over IPC. Keep large, hot payloads (completions) local.
6. **URIs are percent-encoded** (`%2Bpage.svelte`, `%5Bid%5D`). Compare decoded/normalized URIs, never paths built from them.
7. **Unopened documents.** Diagnostics are also pulled for tabs that haven't been opened in the Svelte LS. Those pass through unchanged.
8. **Two copies of the generated-name list** (the extension's completion filter and the LS), because the extension can't deep-import the language server (its package `exports`).
9. **Highlight deferral depends on TS7.** If TS7 is stopped or crashed, the Svelte client returns nothing, and HTML/CSS/Svelte highlights are gone until it's back.
10. **VS Code only.** The middleware hook is a VS Code extension API. Other editors would need their own hook (e.g. a Neovim handler) to call `$/transformTsgoResponse`.
11. **Extra LSP requests only via VS Code commands.** The extension API has no way to send an LSP request to TS7 directly. Nested requests (component tag completions, rename starting at `$store`) go through `vscode.execute*Provider`, so they:
    - run all providers, including the Svelte LS
    - convert the results twice
    - need a re-entrancy guard in the middleware
    - lose the LSP `data` unless it is captured in the middleware

**Not done yet / candidates:**

-   rename edits for `{x}` shorthand and `bind:x` (TS6 rewrote these; needs checking what TS7 produces)
-   dedupe TS7 vs. Svelte LS HTML completions in the template
-   auto-imports in `.svelte` files with existing imports (svelte2tsx span mappings around hoisted imports, see above)
-   filter code actions whose edits land in Svelte syntax
-   folding dedupe
-   `$$ComponentProps` in hovers/messages

**API connection (#3183).** The TS7 extension opens an API pipe into its own language server (`initializeAPIConnection`, LSP request `custom/initializeAPISession`); the Svelte LS connects with `API.fromLSPConnection` (`plugins/typescript-go/TsApiService.ts`). It sees the same project as the LSP, including the virtual code (`sourceFile.text`), `originalText` and the span map, plus the checker and `getReferencedSymbolsForNode`. Used for component references and the references code lens, `$store` (below) and the 18080 relocations (§2.3 C). Things to know:

-   Positions are offsets of the virtual code. `TsApiLocationMapper` converts both ways and maps results with `virtualToOriginalSpanForFeature`, i.e. it honours the span feature masks like TS7's LSP does, and drops results with "none" fidelity (hidden code like the `store_get` argument otherwise maps to an insertion point, e.g. offset 2).
-   Every `getCurrentLanguageServerSnapshot()` creates a new snapshot that lives on both sides until it's disposed. `TsApiService.withProject`/`withSourceFile` scope one request to one snapshot and release it afterwards; nodes and symbols must not escape that scope.
-   The snapshot can be newer or older than the LSP response being transformed. The `$store` and 18080 code compares `sourceFile.originalText` with the LS document and leaves the response alone on a mismatch.
-   `getCompletionsAtPosition` wants a file path (not a URI), a virtual offset, and a snapshot prepared with `snapshot.update({ prepareAutoImports: { uri } })`. Measured on the e2e fixture (7.1.0-beta): it returns the in-scope components (~20–90 ms), but no auto-imports in Svelte files at any virtual position (top level, `$$render` body, end of file), only when the template doesn't parse; and its entries carry no LSP `data`, so `completionItem/resolve` can't compute import edits for them. It therefore can't replace the nested completion request for component tags (§2.5 above), which stays as is.
-   Tests: `test/plugins/typescript-go/middleware/apiFeatures.test.ts` opens an API session on the test's `tsgo --lsp` the same way (`createTsApiServiceForTest`).

**`$store` ↔ `store` (Svelte LS with the TS7 API, `language-server/src/plugins/typescript-go/middleware/stores.ts`).**

svelte2tsx emits one hidden `let $store = __sveltets_2_store_get(store);` per file, unmapped. TS7 therefore treats `store` and `$store` as unrelated variables. Measured with `lsp-dump`:

-   rename on `$store` only renames the `$store` usages
-   rename on `store` only renames the declaration
-   references on `$store` return all `$store` usages of the file
-   definition on `$store` returns `[]`

The fix belongs in the middleware, not in svelte2tsx. The per-usage transformation was dropped in #1531 because of its edge cases. Through the API, the hidden declaration can be followed semantically: from a `$store` usage (`getSymbolAtLocation` → its declaration is the hidden `let $store = __sveltets_2_store_get(store)`) to the store argument, and from a store to all its subscriptions (its references include the hidden argument in every subscribing file, aliases included). TS7 still does the actual rename/references work: scope, cross-file edits and import rewriting.

| Feature                              | Implementation                                                                                                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| references `store` / `$store`        | LS: references of the store (from `$store`: of the `store_get` argument), plus the `$store` usages of every subscription. Also for a store declared in a `.ts` file. Identifiers without subscriptions keep TS7's result.            |
| definition / implementation `$store` | LS: declarations of the store symbol, through aliases (`getAliasedSymbol`), as location links                                                                                                                                        |
| prepareRename `$store`               | LS: shrink the range to `store` (TS7 accepts prepareRename here; the middleware can't override a TS7 _error_)                                                                                                                        |
| rename `store`                       | LS: add `$store` → `$newName` edits in every file whose local binding TS7 renames (`x` → `new` or `x as new`, not `new as x`; checked against the semantic binding range)                                                            |
| rename `$store`                      | extension: asks the LS where `store` is bound (`$/tsgoStoreBinding`), then `vscode.executeDocumentRenameProvider` there; that result comes back through the rule above. The only part that needs the extension (LSP rename request). |
| store misuse diagnostic              | LS: see §2.3 C                                                                                                                                                                                                                       |

Two rename shapes come from TS itself:

-   Renaming at the declaration rewrites importers to `import { total }`.
-   Renaming at an import specifier (`$count` → `total` in an importing file) gives `import { count as total }` and leaves the export alone.

Status: implemented and verified by the e2e harness (local store, imported store, aliased import; each rename checks that export, import specifiers and `$x` usages still fit together) and by `apiFeatures.test.ts`. Compared to the earlier text heuristic it also handles stores with a shadowing declaration in a nested scope, destructured declarations (`const { store } = …`), and `$x` text that isn't a store subscription, without reading files or nested `vscode.executeReferenceProvider`/`executeDefinitionProvider` calls.

### 2.6 E2E harness (`e2e/`)

The workspace package `@svelte/e2e` runs the Svelte extension together with the TS7 extension in a real VS Code.

1. `pnpm build` (repo root).
2. `pnpm --filter @svelte/e2e e2e`:
    - downloads VS Code into `e2e/.vscode-test`
    - installs the TS7 extension from the marketplace into `e2e/.cache/extensions`: `TypeScriptTeam.native-preview`, pinned to 1.0.2 (`tsExtension` in `scripts/paths.mjs`). To test an unreleased extension, set `TS_EXTENSION_PATH` to a local build (`packages/vscode-typescript` of a microsoft/TypeScript checkout after `npm run extension:build`); it's then loaded as a development extension instead.
    - creates a fresh profile with `useTsgo`, inlay hints on, and `js/ts.tsdk.path` = the `typescript-next` devDependency (pinned `7.1.0-dev.20261103.1`; override with `TSDK`). The extension's bundled server is 7.0.2, which has no content mappers.
    - loads the Svelte extension as a development extension
    - runs `runner/fixtures.cjs` in the extension host on `fixtures/basic`
    - evaluates `scripts/expectations.mjs`: 57 checks, PASS/FAIL, plus INFO for known gaps
    - `--only typing,tagCompletion` runs only some probe groups (see `enabled(...)` in the runner)
    - A spy middleware registered before the Svelte extension activates records TS7's raw responses. `e2e/.results/fixtures.json` therefore has raw vs. final for every probe.
3. `pnpm --filter @svelte/e2e e2e:project --workspace <dir> --files a.svelte,b.svelte`: smoke test on a real project (raw vs. shown diagnostics, completion counts).
4. `pnpm --filter @svelte/e2e lsp-dump <workspace> <requests.json>`: drives the TS7 LSP directly, without VS Code, to see what TS7 itself returns. `{ "method": "$sleep", "ms": 2000 }` entries wait in between.

Manual testing: the launch config "Run VS Code Extension with TypeScript 7 (e2e fixture)" opens `e2e/fixtures/basic` with the Svelte extension as a development extension. The TS7 extension comes from your normal VS Code install; it needs `TypeScriptTeam.native-preview` 1.0.2 or newer. The fixture's `.vscode/settings.json` turns on `useTsgo`, content mappers and inlay hints, and points `js/ts.tsdk.path` at the `typescript-next` nightly. Confirm the TS7 extension's "use workspace version" prompt once, or set `js/ts.tsdk.path` in your user settings.

Notes:

-   On Linux without a display, use `xvfb-run -a`; WSLg works as is.
-   The `typing` probe simulates keystrokes with the `type` command. That needs a focused VS Code window, which WSLg doesn't always grant, e.g. while you work in another window. Without focus, the probe reports INFO "skipped". The `tagCompletion` probes test the same thing deterministically through `vscode.executeCompletionItemProvider`.
-   Fixture `node_modules` are symlinks created by the scripts (mapper → `packages/typescript-content-mapper`, `svelte` → the `svelte5` devDependency), not workspace dependencies. There are two reasons:
    -   TS7 only loads mappers from inside the workspace.
    -   Svelte 5 in the pnpm workspace changes the hidden-hoisted `svelte` (`node_modules/.pnpm/node_modules`, which pnpm puts on `NODE_PATH`). That broke language-server tests that resolve Svelte with `require.resolve(..., { paths })`.
-   Not part of `pnpm test`/CI: it needs a display and downloads VS Code and the TS7 extension.

---

## 3. Running svelte-check natively on TypeScript 7

### 3.1 Today

-   **Default:** TS6 LanguageService (`packages/language-server/src/svelte-check.ts`).
-   **`--incremental` / `--tsgo`:**
    -   Writes svelte2tsx output to disk (`.svelte-kit/.svelte-check`, `++X.svelte.ts` + `X.d.svelte.ts` stubs, Kit files via `upsertKitFile`) and generates an overlay tsconfig.
    -   Spawns `tsc` (the TS7 binary with `--tsgo`) and **parses its CLI text output** (header line only, so chained messages are lost).
    -   Maps positions back by re-running svelte2tsx and the TS6 mapping/filtering code (`packages/svelte-check/src/incremental.ts`).
-   **`--tsgo-experimental-api`:**
    -   Uses the TS7 `typescript/sync` API with a **virtual file-system proxy** that serves svelte2tsx output for `.svelte` and rewritten Kit files.
    -   Maps diagnostics back with svelte2tsx source maps, partly using the TS7 checker/AST for fix-ups (`plugins/typescript-go/features/DiagnosticsProvider.ts`).
    -   It explicitly rejects content mappers: TS 18068 → "Content mappers are not yet supported".
-   **All tsgo modes still need TS6.** svelte2tsx parsing, `ts.sys`, config parsing, `ts.createSourceFile` for offset computation, `flattenDiagnosticMessageText`, `DiagnosticCategory`, `WatchDirectoryFlags`, and the whole language-server import graph. Users therefore install both:
    ```
    npm i -D typescript@~6 @typescript/native@npm:typescript@7
    ```
    The peer dependency is still `typescript ^5 || ^6`.

### 3.2 Target design (next major)

Let TypeScript do the mapping. svelte-check becomes:

1. Svelte compiler / CSS diagnostics per `.svelte` file. This only needs `svelte`.
2. TypeScript diagnostics from TS7 using the user's tsconfig with `contentMappers`. Use the TS7 **API** with `runExternalCode: true` (supported since 7.1 via `ClientSpawnOptions.runExternalCode`) rather than scraping CLI output. Diagnostics then arrive **already in `.svelte` coordinates**, with structure intact (chains, related info, categories).
3. Merge, filter, and format the output (human/machine formats, thresholds, `--ignore`, `--fail-on-warnings`).

The FS proxy, the on-disk overlay, and the svelte2tsx-based position mapping go away. The editor and CI then use the _same_ transformation.

### 3.3 What's missing

1. **Diagnostics parity.** This is the biggest item. Everything `mapAndFilterDiagnostics` does today must move to the transformation side, because svelte-check no longer sees virtual code:

    - better svelte2tsx output in generated regions
    - span feature masks
    - `diagnosticDirectives`
    - as a last resort, post-filtering by code + position

    This shares work with §2.3 C. The rules the editor middleware applies (`plugins/typescript-go/middleware/diagnostics.ts`) work on LSP-shaped diagnostics in original coordinates plus the document. svelte-check can run the same function over the TS7 API's diagnostics, so the editor and the CLI filter identically. The content-mapper diagnostics test suite (`content-mapper.test.ts`, currently skipped) should become the parity harness against the existing `test-success`/`test-error` fixtures.

2. **SvelteKit `.ts` route files.** Content mappers can't rewrite them. svelte-check could keep a small FS proxy for Kit files only. The sync API accepts `fs` callbacks, so combining them with `runExternalCode` _might_ work _(verify)_. The editor wouldn't get the same behaviour, though, so it ties into the open question in §2.3 B.
3. **Mapper config parity.** svelte.config options, `dynamicConfig`/`watchedFiles`, and `type="text/typescript"` (as in §2.3 C).
4. **Library resolution.** ✅ For libraries that ship declarations next to their `.svelte` files, the mapper serves those declarations, so their sources are no longer checked (§2.3 D). Libraries without such declarations still cause false errors from their `node_modules` `.svelte` files. `skipLibCheck` doesn't apply there, because these are source files, not declarations.
5. **Mapper availability.**
    - Should svelte-check depend on `@sveltejs/ts-content-mapper` and inject the `contentMappers` entry via a generated tsconfig that `extends` the user's? Or should it require the user's tsconfig to have it? Injecting keeps zero-config. Requiring it keeps the CLI `tsc` and the editor consistent.
    - The `node` binary must be on `PATH` for the mapper.
6. **Remove TS6 from svelte-check's runtime.**
    - Config parsing → TS7 API (`parseConfigFile`).
    - `ts.sys` → `node:fs`.
    - Own `flattenDiagnosticMessage` and enums.
    - Split the TS7 path out of the language server's `SvelteCheck` so it doesn't import `TypeScriptPlugin`/TS6 at top level. This item is already on the PR's follow-up list.
    - svelte2tsx inside the mapper is the remaining TS6 user; see §3.4.
7. **Watch mode.** TS7 API snapshots (`createSnapshot`/`update`) + chokidar. Incremental/`tsBuildInfo` behaviour with mapped files is unknown _(verify)_.
8. **`@sveltejs/package` / `emitDts`.** svelte2tsx's `emitDts` refuses TS ≥ 7. With mappers, `tsc --declaration --emitDeclarationOnly` emits `.d.svelte.ts` directly. `emitDts` can become a thin wrapper around that, which also implements the separate-declarations layout from §2.3 D.
9. **Scope decisions for the major.**
    - Svelte 4 in the TS7 path, given the unmappable legacy features.
    - Peer dependency `typescript ^7.1`.
    - Drop `--incremental`/`--tsgo`/`--tsgo-experimental-api` in favour of a single TS7 path.

### 3.4 svelte2tsx and the TypeScript parser

svelte2tsx uses TS's AST pervasively: 3 `createSourceFile` calls, ~200 type-guard call sites over 63 guards, `forEachChild`, the scanner, comment-range helpers, and `getStart`/`getText`/`getFullText`. Inside the mapper process it can keep using **TS6 purely as a parser**, which is exactly what the PR does (`typescript ~6.0.2` dependency of the mapper). That's fine short-term, but:

-   TS6 is frozen, so new TS 7.x syntax will fail to parse in svelte2tsx while TS7 itself accepts it
-   it costs an extra ~20 MB dependency

Options for the long term:

| Option                                                                                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **TS7 API parser** (`typescript/sync` → `api.createSourceFile(...)`)                                               | Returns a decoded JS-side AST (`typescript/ast`). The node API is very close to TS6 (`forEachChild`, `getStart`, `getText`, `getChildren`), with guards in `typescript/ast/is` and the scanner/comment helpers in `typescript/ast/scanner`. Synchronous, so svelte2tsx's design survives. Costs: a `tsc --api` child process per mapper (or the experimental WASM transport). **`SyntaxKind` values differ** (e.g. `Identifier` is 80 in TS6 and 79 in TS7), so svelte2tsx must use an injected `ts` facade rather than a static import. Most of the work is mechanical once that facade exists. |
| **Keep TS6 as a private parser dependency**                                                                        | No work, but syntax drift. Acceptable as a bridge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Switch to ESTree** from Svelte's own parser (Svelte 5 parses `<script lang="ts">` via `acorn-typescript`) or oxc | Removes the TS dependency entirely and avoids parsing twice. But it's a rewrite of most of svelte2tsx: different node shapes, positions and trivia handling. Svelte 4 doesn't give a TS AST.                                                                                                                                                                                                                                                                                                                                                                                                     |

The facade approach (`svelte2tsx` takes a `ts`-like object plus `SyntaxKind`) is a good first step either way. It also lets one svelte2tsx build run against TS6 (legacy LS) and TS7 (mapper).

---

## 4. One extension code base for TS ≤ 6 and TS 7

**Constraints**

-   In VS Code, `.ts/.js` files in a window are served by _either_ the TS6 tsserver (with `typescript-svelte-plugin`) _or_ the TS7 LSP (no plugins); `useTsgo` decides. So mixing per project only matters for `.svelte` files. In a TS7 window, a project without a mapper has no Svelte-aware `.ts` support at all.
-   Each project must have exactly one owner for TypeScript features in its `.svelte` files.
-   svelte2tsx is shared by every option. It must keep producing source maps (TS6) _and_ span maps (TS7). It already does.
-   The TS6 path will be deleted eventually. Its cost should be contained.

### Idea 1 — Two backends behind an ownership router (evolve the PR)

Keep today's `TypeScriptPlugin` (TS6) and content-mapper mode (TS7). Replace the workspace-wide boolean with a **per-project ownership model**:

-   For each `.svelte` document, decide "TS7 + mapper", "TS6", or "none". Ask TS7 when it's running (API connection: `parseConfigFile`/`getDefaultProjectForFile`), otherwise use TS6's config parser.
-   The Svelte LS registers its TS capabilities **dynamically** with document selectors for the TS6-owned projects only. It drops TS7 results for documents it owns, via middleware.
-   Svelte, HTML and CSS features stay unconditional.
-   Code organisation:

    -   `plugins/typescript` (TS6, frozen) and `plugins/typescript-go` (TS7 glue: middleware, API-connection features)
    -   TS6 loaded lazily (`await import('typescript')`) so a TS7-only user never loads it

-   **Pros:** incremental, mostly built already, and the TS6 path stays as it is.
-   **Cons:** every TS-aware Svelte feature exists twice (source-map-based vs span-map-based, LanguageService vs middleware/API), so tests are needed in both modes. Dynamic per-selector registration plus two servers per document is fiddly in VS Code.

### Idea 2 — "TypeScript owns `.svelte`" everywhere: a TS6 tsserver plugin as the content-mapper polyfill

This is the Vue "hybrid mode" approach. Make the TS6 architecture look like TS7:

-   Extend `typescript-svelte-plugin` so that **tsserver itself serves `.svelte` documents**. Contribute `typescriptServerPlugins[].languages: ["svelte"]` so VS Code's TS extension sends `.svelte` docs to tsserver.
-   Inside tsserver, run svelte2tsx and map LS results using the **same span maps and feature masks** the TS7 mapper produces. In effect, a JS re-implementation of TS7's content-mapper host.
-   Volar's `@volar/typescript` does exactly this decoration and could be reused (compare the closed #2242).
-   The Svelte LS drops TypeScript entirely in both modes and only does Svelte/HTML/CSS.
-   Svelte-specific post-processing becomes "middleware" in both worlds: LS decoration in TS6, `registerLspMiddleware` in TS7.

-   **Pros:** one architecture and one mental model. The span-map output is exercised by both. `.ts` ↔ `.svelte` cross-file features work the same. The TS6 piece is a self-contained shim that can be deleted later. The Svelte LS gets much simpler.
-   **Cons:** a large rewrite of the TS6 path, with regression risk for a population that's about to shrink. Other editors then need a TS LSP that loads tsserver plugins (`typescript-language-server`, vtsls) for Svelte TS support. Features that need to merge Svelte and TS results (document highlight, completions) depend on VS Code merging two providers.

### Idea 3 — A `TsBackend` abstraction inside the Svelte LS, with TS7 accessed through its JS API

Keep the Svelte LS as the place where Svelte-specific TS intelligence lives, behind an interface with a TS6 implementation (LanguageService) and a TS7 implementation (`typescript/async` API attached to the TS7 LSP's own session via `initializeAPIConnection` + `API.fromLSPConnection`/`getCurrentLanguageServerSnapshot`, so both see the same project and mapped files).

-   **Don't** use it for generic features, because the TS7 API isn't a LanguageService. Content mappers handle those.
-   **Do** use it for everything Svelte-specific that needs types:

    -   component/file references (`getReferencedSymbolsForNode`)
    -   SvelteKit export completions/hover
    -   `$store` definition, component-event hover
    -   Svelte-specific code actions (`getImportEditsForSymbols`, `formatNodeForInsertion`)
    -   accurate mode/capability detection

    Each feature is written once against `TsBackend`, with both TS6 and TS7 implementations.

-   **Pros:** targets exactly the gap that content mappers + middleware can't close. Feature logic is shared between the two backends. Fits Idea 1 or 2 as a complementary layer.
-   **Cons:** the TS7 API is async and remote (latency, batching via `batchContext`), its surface is still moving, and adapter work is needed to normalise TS6 vs TS7 types (`SyntaxKind` numbering, symbol/type objects). Not a complete solution by itself.

### Idea 4 — Package-level split with runtime selection

Treat TS6 support as a legacy add-on rather than a branch in the code:

-   `svelte-language-server` core: Svelte/HTML/CSS + the TS7 glue, with no `typescript` import.
-   `@sveltejs/language-server-ts6`: today's `TypeScriptPlugin` + `typescript-svelte-plugin`, depending on `typescript@6`.
-   The extension bundles both and loads the TS6 package per workspace folder when that folder isn't on TS7 (the same signal as Idea 1). The two run as separate LS processes, or one process with a lazily `import()`ed plugin.
-   svelte2tsx gets the `ts` facade from §3.4, so the same build runs against TS6 (legacy package) and the TS7 parser (mapper).
-   Variant: publish a separate "Svelte (legacy TypeScript)" extension from the same monorepo once TS7 is the default, and make the main extension TS7-only.

-   **Pros:** hard boundary, so the TS6 code can't leak into new work and can be frozen and deleted on a timeline. Smaller install/memory footprint for TS7 users. Clean to reason about.
-   **Cons:** packaging and lifecycle complexity (two LS processes, version skew between packages). It doesn't by itself solve the "who owns this document" problem, so it needs Idea 1's router or a coarser per-window choice. The variant with a second extension is confusing for users.

### Recommendation sketch

**Short term (ship TS7 support behind opt-in)**

-   Idea 1 with per-project ownership.
-   Idea 4's lazy loading and package boundary, so TS6 is never loaded for TS7 users.
-   Idea 3's API connection, used only for Svelte-specific semantic features.

**Long term**

-   Freeze the TS6 backend and delete it once TS ≤ 6 usage is low.
-   Consider Idea 2 only if TS6 has to be supported for a long time, or if we want a single architecture before TS6 can be dropped.
