# Changelog

## 0.17.27

### Patch Changes

-   fix: handle relative imports reaching outside working directory when using `--incremental/--tsgo` flags ([#2942](https://github.com/sveltejs/language-tools/pull/2942))

-   fix: extract style/script tag followed by destructuring in the template ([#2921](https://github.com/sveltejs/language-tools/pull/2921))

-   fix: support SvelteKit zero types in svelte-check --incremental ([#2939](https://github.com/sveltejs/language-tools/pull/2939))

-   Updated dependencies [[`6a04679`](https://github.com/sveltejs/language-tools/commit/6a04679e600c7a9ecd0bcdb9476c4edd4bdf6e72), [`b914d01`](https://github.com/sveltejs/language-tools/commit/b914d0104ba5326cc607039313dd8993a6e141fd)]:
    -   svelte2tsx@0.7.49

## 0.17.26

### Patch Changes

-   feat: add links to diagnostic error codes via codeDescription ([#2936](https://github.com/sveltejs/language-tools/pull/2936))

-   chore: provide utils for svelte-check ([#2932](https://github.com/sveltejs/language-tools/pull/2932))

-   Updated dependencies [[`0b8af82`](https://github.com/sveltejs/language-tools/commit/0b8af829a3ceadd0cd08754a9edcb6cc353cb20f)]:
    -   svelte2tsx@0.7.48

## 0.17.25

### Patch Changes

-   fix: apply text synchronize change in order ([#2927](https://github.com/sveltejs/language-tools/pull/2927))

## 0.17.24

### Patch Changes

-   perf: only parse html once in a batch update ([#2923](https://github.com/sveltejs/language-tools/pull/2923))

-   feat: support emmet.extensionsPath config ([#2918](https://github.com/sveltejs/language-tools/pull/2918))

-   feat: custom element JSDoc documentation for completion/hover ([#2879](https://github.com/sveltejs/language-tools/pull/2879))

-   fix: compatibility with prettier-plugin-tailwindcss in monorepo ([#2925](https://github.com/sveltejs/language-tools/pull/2925))

-   Updated dependencies [[`e2f09eb`](https://github.com/sveltejs/language-tools/commit/e2f09eb1379a08983c48518e7af65a49736fa813)]:
    -   svelte2tsx@0.7.47

## 0.17.23

### Patch Changes

-   perf: move return statement in `getCompletions` so it returns immediately if possible ([#2899](https://github.com/sveltejs/language-tools/pull/2899))

-   perf: avoid global completion in component start tag ([#2904](https://github.com/sveltejs/language-tools/pull/2904))

-   perf: optimize path normalization ([#2907](https://github.com/sveltejs/language-tools/pull/2907))

-   perf: optimize module resolution cache invalidation check ([#2902](https://github.com/sveltejs/language-tools/pull/2902))

-   fix: add some limit to store auto-import ([#2909](https://github.com/sveltejs/language-tools/pull/2909))

-   [perf]: avoid re-reacting completion items for svelte syntax every time `getCompletionsWithRegardToTriggerCharacter` is called ([#2900](https://github.com/sveltejs/language-tools/pull/2900))

-   Updated dependencies [[`b6ebbd8`](https://github.com/sveltejs/language-tools/commit/b6ebbd83e7495db187d2ebc15d3b9e372623e1a7)]:
    -   svelte2tsx@0.7.46

## 0.17.22

### Patch Changes

-   feat: support hierarchical document symbols ([#2817](https://github.com/sveltejs/language-tools/pull/2817))

-   fix: use moustache for svelte5 onhandler completion ([#2883](https://github.com/sveltejs/language-tools/pull/2883))

-   feat: quick fix for adding lang="ts" ([#2882](https://github.com/sveltejs/language-tools/pull/2882))

-   fix: support for @nativescript-community/svelte-native ([#2867](https://github.com/sveltejs/language-tools/pull/2867))

-   fix: always treat a script tag as top-level if it's the first tag in the file ([#2886](https://github.com/sveltejs/language-tools/pull/2886))

-   fix: restrict emmet completion with emmet specific triggerCharacter ([#2873](https://github.com/sveltejs/language-tools/pull/2873))

-   fix: support experimental feature in "Show compiled Code" ([#2884](https://github.com/sveltejs/language-tools/pull/2884))

-   feat: implement 'source.removeUnusedImports' code action ([#2875](https://github.com/sveltejs/language-tools/pull/2875))

## 0.17.21

### Patch Changes

-   perf: check if file content changed in tsconfig file watch ([#2859](https://github.com/sveltejs/language-tools/pull/2859))

-   Updated dependencies [[`7468286`](https://github.com/sveltejs/language-tools/commit/7468286afd56b886f5490adebe6f667306d0fe08)]:
    -   svelte2tsx@0.7.45

## 0.17.20

### Patch Changes

-   perf: tweak some snapshot hot paths ([#2852](https://github.com/sveltejs/language-tools/pull/2852))

-   perf: more precise module cache invalidation ([#2853](https://github.com/sveltejs/language-tools/pull/2853))

-   Updated dependencies [[`f799839`](https://github.com/sveltejs/language-tools/commit/f799839a5a5dfc5dcffdc42fb34b5b10b4345be5), [`dec37ea`](https://github.com/sveltejs/language-tools/commit/dec37eabe44370615d98af2d19ae6ed7feafc297)]:
    -   svelte2tsx@0.7.44

See https://github.com/sveltejs/language-tools/releases
