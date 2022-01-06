# SCSS/Less Support

The following document mainly talks about SCSS, but the same applies for Less.

## Setup

#### 1. Install the required npm packages

You first need to install the npm package which can actually transpile the language to css.

-   SCSS: `sass` / `node-sass`
-   Less: `less`

You also need a Svelte preprocessor which connects the preprocessing with SCSS/Less. We recommend using [svelte-preprocess](https://github.com/sveltejs/svelte-preprocess).

> Example of installing both when using SCSS:

```sh
npm i -D svelte-preprocess sass
```

#### 2. Setting up a svelte-config.js

You need a `svelte.config.js`. [Read here on how to set it up and also how it relates to your build config](./in-general.md). If you are using [svelte-preprocess](https://github.com/sveltejs/svelte-preprocess) (recommended), this is enough:

ESM-style (for everything with `"type": "module"` in its `package.json`, like SvelteKit):

```js
import sveltePreprocess from 'svelte-preprocess';

export default {
    preprocess: sveltePreprocess()
};
```

CJS-style:

```js
const sveltePreprocess = require('svelte-preprocess');

module.exports = {
    preprocess: sveltePreprocess()
};
```

#### 3. Using the lang/type attributes to make us understand the language

To gain syntax highlighing for your SCSS code and to make us understand the language you are using, add a `type` or `lang` attribute to your style tags like so:

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

#### 4. Restart the svelte language server

You will need to tell svelte-vscode to restart the svelte language server in order to pick up the new configuration.

Hit `ctrl-shift-p` or `cmd-shift-p` on mac, type `svelte restart`, and select `Svelte: Restart Language Server`. Any errors you were seeing should now go away and you're now all set up!

## Troubleshooting / FAQ

### SCSS: Using node-sass and having errors?

The `node-sass` package is very sensitive to node versions. It may be possible that this plugin runs on a different version than your application. Then it is necessary to set the `svelte.language-server.runtime` setting to the path of your node runtime. E.g. `"svelte.language-server.runtime": "/<LOCAL_PATH>/bin/node"`.

### SCSS: Using `includePaths` does not work

If you use `includePaths` with relative paths, those paths will be resolved relative to the node process, not relative to the config file. So if you `svelte.config.js` is within `frontend`, the path `theme` will _NOT_ resolve to `frontend/theme` but to `<node process root>/theme` (which might be the same as `frontend`). To ensure it always resolves relative to the config file, do this (assuming a CJS-style config):

```js
const sveltePreprocess = require('svelte-preprocess');
const path = require('path');

module.exports = {
    preprocess: sveltePreprocess({ includePaths: [path.join(__dirname, 'relative/path')] })
};
```
