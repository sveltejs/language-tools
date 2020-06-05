# TypeScript Support

### Getting it to work in the editor

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

You may optionally want to add a `svelte.config.js` file (see below) - this used to be necessary but is no longer required as long as you only use TypeScript.

### Getting it to work for your build

For the editor, this is already enough - nothing more to do. But you also need to enhance your build config. Using Rollup, this will work with Svelte and TypeScript as long as you enable `svelte-preprocess` and `@rollup/plugin-typescript`:

- Install these packages `npm i svelte-preprocess typescript tslib @rollup/plugin-typescript`
- Add these lines to `rollup.config.js`:

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

And this should work to enable full TypeScript checking in your Svelte files. For further discussion and a clonable template [see this issue](https://github.com/sveltejs/language-tools/issues/161).

> Caveat: Your entry file (`main.js`) has still to be a javascript file

### Example configuration for the editor

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
