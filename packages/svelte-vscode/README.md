# Svelte for VS Code

Provides syntax highlighting and rich intellisense for Svelte components in VS Code, utilising the [svelte language server](../language-server).

## Features

-   Svelte
    -   Diagnostic messages for warnings and errors
    -   Support for svelte preprocessors that provide source maps
    -   Svelte specific formatting (via [prettier-plugin-svelte](https://github.com/UnwrittenFun/prettier-plugin-svelte))
-   HTML
    -   Hover info
    -   Autocompletions
    -   [Emmet](https://emmet.io/)
    -   Symbols in Outline panel
-   CSS / SCSS / LESS
    -   Diagnostic messages for syntax and lint errors
    -   Hover info
    -   Autocompletions
    -   Formatting (via [prettier](https://github.com/prettier/prettier))
    -   [Emmet](https://emmet.io/)
    -   Color highlighting and color picker
    -   Symbols in Outline panel
-   TypeScript / JavaScript
    -   Diagnostics messages for syntax errors, semantic errors, and suggestions
    -   Hover info
    -   Formatting (via [prettier](https://github.com/prettier/prettier))
    -   Symbols in Outline panel
    -   Autocompletions
    -   Go to definition
    -   Code Actions

### Using with preprocessors

#### Language specific setup

-   [SCSS](docs/preprocessors/scss.md)
-   [TypeScript](docs/preprocessors/typescript.md)

#### Generic setup

If a svelte file contains some language other than `html`, `css` or `javascript`, `svelte-vscode` needs to know how to [preprocess](https://svelte.dev/docs#svelte_preprocess) it. This can be achieved by creating a `svelte.config.js` file at the root of your project which exports a svelte options object (similar to `svelte-loader` and `rollup-plugin-svelte`).

```js
// svelte.config.js
const preprocess = require('my-example-svelte-preprocessor');

module.exports = {
    preprocess: [preprocess()],
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

### Settings

##### `svelte.language-server.runtime`

Path to the node executable you would like to use to run the language server.
This is useful when you depend on native modules such as node-sass as without
this they will run in the context of vscode, meaning v8 version mismatch is likely.

##### `svelte.language-server.port`

At which port to spawn the language server.
Can be used for attaching to the process for debugging / profiling.
If you experience crashes due to "port already in use", try setting the port.
-1 = default port is used.

##### `svelte.plugin.typescript.enable`

Enable the TypeScript plugin. _Default_: `true`

##### `svelte.plugin.typescript.diagnostics`

Enable diagnostic messages for TypeScript. _Default_: `true`

##### `svelte.plugin.typescript.hover`

Enable hover info for TypeScript. _Default_: `true`

##### `svelte.plugin.typescript.documentSymbols`

Enable document symbols for TypeScript. _Default_: `true`

##### `svelte.plugin.typescript.completions`

Enable completions for TypeScript. _Default_: `true`

##### `svelte.plugin.typescript.definitions`

Enable go to definition for TypeScript. _Default_: `true`

##### `svelte.plugin.typescript.codeActions`

Enable code actions for TypeScript. _Default_: `true`

##### `svelte.plugin.css.enable`

Enable the CSS plugin. _Default_: `true`

##### `svelte.plugin.css.diagnostics`

Enable diagnostic messages for CSS. _Default_: `true`

##### `svelte.plugin.css.hover`

Enable hover info for CSS. _Default_: `true`

##### `svelte.plugin.css.completions`

Enable auto completions for CSS. _Default_: `true`

##### `svelte.plugin.css.documentColors`

Enable document colors for CSS. _Default_: `true`

##### `svelte.plugin.css.colorPresentations`

Enable color picker for CSS. _Default_: `true`

##### `svelte.plugin.css.documentSymbols`

Enable document symbols for CSS. _Default_: `true`

##### `svelte.plugin.html.enable`

Enable the HTML plugin. _Default_: `true`

##### `svelte.plugin.html.hover`

Enable hover info for HTML. _Default_: `true`

##### `svelte.plugin.html.completions`

Enable auto completions for HTML. _Default_: `true`

##### `svelte.plugin.html.tagComplete`

Enable HTML tag auto closing. _Default_: `true`

##### `svelte.plugin.html.documentSymbols`

Enable document symbols for HTML. _Default_: `true`

##### `svelte.plugin.svelte.enable`

Enable the Svelte plugin. _Default_: `true`

##### `svelte.plugin.svelte.diagnostics.enable`

Enable diagnostic messages for Svelte. _Default_: `true`

##### `svelte.plugin.svelte.format.enable`

Enable formatting for Svelte (includes css & js). _Default_: `true`
