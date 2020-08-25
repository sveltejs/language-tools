# Svelte Language Server

Powering `svelte-check`, `Svelte for VS Code` and other IDE extensions who use it.

## Setup

Do you want to use TypeScript/SCSS/Less/..? See [Using with preprocessors](#using-with-preprocessors).

### Using with preprocessors

[Generic setup](./preprocessors/in-general.md)

#### Language specific setup

-   [SCSS/Less](./preprocessors/scss-less.md)
-   [Other CSS languages, TailwindCSS](./preprocessors/other-css-preprocessors.md)
-   [TypeScript](./preprocessors/typescript.md)

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

#### Component syntax highlighting does not work

If your syntax highlighting seems to be not working for Svelte components, it may be that your color theme either sets the component color to "white" or does not set this kind of token at all. To change this in VSCode, you can add something like the following to your `settings.json`:

```
{
    "editor.tokenColorCustomizations": {
        "[<Name of your theme>]": {
            "textMateRules": [
                {
                    "settings": {
                        "foreground": "#569CD6", // any color you like
                    },
                    "scope": "support.class.component.svelte"
                }
            ],
        },
    }
}
```

#### `export let ...` breaks my syntax highlighting

If you have the `Babel Javascript` plugin installed, this may be the cause. Disable it for Svelte files.

#### My Code does not get formatted

Your default formatter for Svelte files may be wrong. Either it's set to the old Svelte extension, or you set all files to be formatted by the prettier extension. To fix this, you need to explicitly tell VSCode to format the code with the `Svelte for VSCode extension`:

```json
  "[svelte]": {
    "editor.defaultFormatter": "svelte.svelte-vscode"
  },
```

## Internals

-   [Notes about deployment](./internal/deployment.md)
-   [Overview of the language-tools and how things work together](./internal/overview.md)
