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

**Note**: `svelte-preprocess` supports passing an array of preprocessors (e,g, `preprocess: [postcss(), typescript()]`), but this is **not** currently supported by the language server.

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

## Documenting components

To add documentation on a Svelte component that will show up as a docstring in
LSP-compatible editors, you can use an HTML comment with the `@component` tag:

```html
<!--
 @component
 Here's some documentation for this component. It will show up on hover for
 JavaScript/TypeScript projects using a LSP-compatible editor such as VSCode or
 Vim/Neovim with coc.nvim.

 - You can use markdown here.
 - You can use code blocks here.
 - JSDoc/TSDoc will be respected by LSP-compatible editors.
 - Indentation will be respected as much as possible.
-->

<!-- @component You can use a single line, too -->

<!-- @component But only the last documentation comment will be used -->

<main>
  <h1>
    Hello world
  </h1>
</main>
```

## Troubleshooting / FAQ

### Using TypeScript? See [this section](./preprocessors/typescript.md#troubleshooting--faq)

### Using SCSS or Less? See [this section](./preprocessors/scss-less.md#troubleshooting--faq)

#### If I update a TS/JS file, Svelte does not seem to recognize it

You need to save the file to see the changes. If the problem persists after saving, check if you have something like this set in your settings:

```json
"files.watcherExclude": {
  "**/*": true,
}
```

If so, this will prevent the language server from getting noticed about updates, because it uses a file watcher for `js`/`ts` files.

## Internals

-   [Notes about deployment](./internal/deployment.md)
