# Svelte Language Server

Powering `svelte-check`, `Svelte for VS Code` and other IDE extensions who use it.

## Setup

Do you want to use TypeScript/SCSS/Less/..? See [Using with preprocessors](#using-with-preprocessors).

### Using with preprocessors

#### Language specific setup

-   [SCSS/Less](./preprocessors/scss-less.md)
-   [TypeScript](./preprocessors/typescript.md)

#### Generic setup

If a svelte file contains some language other than `html`, `css` or `javascript`, `svelte-vscode` needs to know how to [preprocess](https://svelte.dev/docs#svelte_preprocess) it. This can be achieved by creating a `svelte.config.js` file at the root of your project which exports a svelte options object (similar to `svelte-loader` and `rollup-plugin-svelte`). It's recommended to use the official [svelte-preprocess](https://github.com/sveltejs/svelte-preprocess) package which can handle many languages.

```js
// svelte.config.js - NOTE: you cannot use the new "import x from y" and "export const" syntax in here.
const sveltePreprocess = require('svelte-preprocess');

module.exports = {
    preprocess: sveltePreprocess(),
    // ...other svelte options
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

## Troubleshooting / FAQ

### Using TypeScript? See [this section](./preprocessors/typescript.md#troubleshooting-faq)

### Using SCSS or Less? See [this section](./preprocessors/scss-less.md#troubleshooting-faq)

## Internals

-   [Notes about deployment](./internal/deployment.md)
