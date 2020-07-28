# TypeScript Support

## Getting it to work in the editor

To tell us to treat your script tags as typescript, add a `type` or `lang` attribute to your script tags like so:

```html
<!-- Add type="text/typescript" -->
<script type="text/typescript">
    export let name: string;
</script>

<!-- Or add lang="typescript" or lang="ts" -->
<script lang="typescript">
    export let name: string;
</script>
```

You may optionally want to add a `svelte.config.js` file (see below) - but it is not required as long as you only use TypeScript.

## Getting it to work for your build

For the editor, this is already enough - nothing more to do. But you also need to enhance your build config. Using Rollup, this will work with Svelte and TypeScript as long as you enable `svelte-preprocess` and `@rollup/plugin-typescript`:

-   Install these packages `npm i -D svelte-preprocess typescript tslib @rollup/plugin-typescript`
-   Add these lines to `rollup.config.js`:

```js
// ...
import sveltePreprocess from 'svelte-preprocess';
import typescript from '@rollup/plugin-typescript';

// ...
  plugins: [
    svelte({
      // ...
      preprocess: sveltePreprocess(), // <--
    }),

    // ...
    commonjs(),
    typescript(), // <-- added below commonjs
    // ...
```

-   Add a `tsconfig.json` with these lines:

```json
{
    "include": ["src/**/*"],
    "exclude": ["node_modules/*", "__sapper__/*", "public/*"],
    "compilerOptions": {
        "moduleResolution": "node",
        "sourceMap": true,
        "target": "es2017",
        "types": ["svelte"]
    }
}
```

And this should work to enable full TypeScript checking in your Svelte files. For further discussion and a clonable template [see this issue](https://github.com/sveltejs/language-tools/issues/161).

## Example configuration for the editor

#### Using [svelte-preprocess](https://github.com/sveltejs/svelte-preprocess)

##### Install

```sh
npm i -D svelte-preprocess typescript
```

<details>
<summary>Yarn</summary>

```sh
yarn add --dev svelte-preprocess typescript
```

</details>

##### Set up `svelte.config.js`

```js
const sveltePreprocess = require('svelte-preprocess');

module.exports = {
    preprocess: sveltePreprocess(),
};
```

##### Restart the svelte language server

You will need to tell svelte-vscode to restart the svelte language server in order to pick up the new configuration.

Hit `ctrl-shift-p` or `cmd-shift-p` on mac, type `svelte restart`, and select `Svelte: Restart Language Server`. Any errors you were seeing should now go away and you're now all set up!

## Troubleshooting / FAQ

### How do I type reactive assignments? / I get an "implicitly has type 'any' error"

The following code may throw an error like `Variable 'show' implicitly has type 'any' in some locations where its type cannot be determined.`, if you have stricter type settings:

```html
<script lang="typescript">
    export let data: { someKey: string | null };

    $: show = !!data.someKey; // <-- `show` has type `any`
</script>

{#if show}hey{/if}
```

To type the variable, do this:

```ts
let show: boolean; // <--- added above the reactive assignment
$: show = !!data.someKey; // <-- `show` now has type `boolean`
```

### How do I import interfaces into my Svelte components? I get errors after transpilation!

-   If you use `svelte-preprocess` BELOW `v4.x` and did NOT set `transpileOnly: true`, then make sure to have at least `v3.9.3` installed, which fixes this.
-   If you don't use `svelte-preprocess` OR use `transpileOnly: true` (which makes transpilation faster) OR use `v4.x`, import interfaces like this: `import type { SomeInterface } from './MyModule.ts'`. You need a least TypeScript 3.8 for this.

### Can I use TypeScript syntax inside the template/mustache tags?

At the moment, you cannot. Only `script`/`style` tags are preprocessed/transpiled. See [this issue](https://github.com/sveltejs/svelte/issues/4701) for more info.
