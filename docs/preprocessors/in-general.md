# Using Preprocessors

## Generic setup

If a svelte file contains some language other than `html`, `css` or `javascript`, `svelte-vscode` needs to know how to [preprocess](https://svelte.dev/docs#svelte_preprocess) it. This can be achieved by creating a `svelte.config.js` file at the root of your project which exports a svelte options object (similar to `svelte-loader` and `rollup-plugin-svelte`). It's recommended to use the official [svelte-preprocess](https://github.com/sveltejs/svelte-preprocess) package which can handle many languages.

```js
// svelte.config.js - NOTE: you cannot use the new "import x from y" and "export const" syntax in here.
const sveltePreprocess = require('svelte-preprocess');

module.exports = {
    preprocess: sveltePreprocess(),
};
```

It's also necessary to add a `type="text/language-name"` or `lang="language-name"` to your `style` and `script` tags, which defines how that code should be interpreted by the extension.

```html
<div>
    <h1>Hello, world!</h1>
</div>

<style type="text/scss">
    div {
        h1 {
            color: red;
        }
    }
</style>
```

#### Using language defaults

If you use `svelte-preprocess` and define the defaults inside `svelte.config.js`, you can omit the `type`/`lang` attributes. These get picked up by the language server.

```
const sveltePreprocess = require('svelte-preprocess');

module.exports = {
    preprocess: sveltePreprocess({
        defaults: {
            script: 'typescript' // <-- now you can just write <script>let typingsAllowed: string;</script>
        }
    }),
};
```

#### Deduplicating your configs

Most of the preprocessor settings you write inside your `svelte.config.js` is likely duplicated in your build config. Here's how to deduplicate it (using rollup as an example):

```js
// svelte.config.js:
const sveltePreprocess = require('svelte-preprocess');

// using sourceMap as an example, but could be anything you need dynamically
function createPreprocessors(sourceMap) {
    return sveltePreprocess({
        sourceMap,
        // ... your settings
    });
}

module.exports = {
    preprocess: createPreprocessors(true),
    createPreprocessors,
};
```

```js
// rollup.config.js:
// ...

const createPreprocessors = require('./svelte.config').createPreprocessors;
const production = !process.env.ROLLUP_WATCH;

export default {
    // ...

    plugins: [
        // ...
        svelte({
            // enable run-time checks when not in production
            dev: !production,

            // we'll extract any component CSS out into
            // a separate file - better for performance
            css: (css) => {
                css.write('public/build/bundle.css');
            },
            preprocess: createPreprocessors(!production),
        }),
        // ...
    ],
};
```

#### Restart the svelte language server

You will need to tell svelte-vscode to restart the svelte language server in order to pick up a new configuration.

Hit `ctrl-shift-p` or `cmd-shift-p` on mac, type `svelte restart`, and select `Svelte: Restart Language Server`. Any errors you were seeing should now go away and you're now all set up!
