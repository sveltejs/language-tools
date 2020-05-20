# SCSS/Less Support

The following document talks about SCSS, but the same applies for Less.

## Syntax Highlighting

To gain syntax highlighing for your SCSS code, add a `type` or `lang` attribute to your style tags like so:

```html
<!-- Add type="text/scss" -->
<style type="text/scss">
    header {
        h1 {
            color: purple;
        }
    }
</style>

<!-- Or add lang="scss" -->
<style lang="scss">
    header {
        h1 {
            color: purple;
        }
    }
</style>
```

## Fix svelte errors

The highlighter can now understand the syntax, but svelte still can't.
For that you will need to add a `svelte.config.js` file at the root of your project to tell svelte how to convert your SCSS into CSS that it understands.

You likely already have this configuration somewhere if you are/are planning to use SCSS with svelte, e.g. webpack config, rollup config, etc.

_Tip: To avoid duplication of config, you can import the `svelte.config.js` file in your bundle configuration_

### Example Configurations

#### Using [svelte-preprocess](https://github.com/sveltejs/svelte-preprocess)

##### Install

```sh
npm i -D svelte-preprocess node-sass
```

<details>
<summary>Yarn</summary>

```sh
yarn add --dev svelte-preprocess node-sass
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

## SCSS: Still having errors?

The `node-sass` package is very sensitive to node versions. It may be possible that this plugin runs on a different version than your application. Then it is necessary to set the `svelte.language-server.runtime` setting to the path of your node runtime.
