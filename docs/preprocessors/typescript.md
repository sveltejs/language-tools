# TypeScript Support

To tell us to treat your script tags as typescript, add a `type` or `lang` attribute to your script tags like so:

```html
<!-- Add type="text/typescript" -->
<script type="text/scss">
    export let name: string;
</script>

<!-- Or add lang="typescript" -->
<script lang="typescript">
    export let name: string;
</script>
```

Now you'll need to add a `svelte.config.js` file at the root of your project to tell svelte how to convert your TypeScript into JavaScript that it understands.

You likely already have this configuration somewhere if you are/are planning to use TypeScript with svelte, e.g. webpack config, rollup config, etc.

_Tip: To avoid duplication of config, you can import the `svelte.config.js` file in your bundle configuration_

### Example Configurations

#### Using [svelte-preprocess](https://github.com/kaisermann/svelte-preprocess) by [@kaisermann](https://github.com/kaisermann)

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
