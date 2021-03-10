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
    <h1>Hello world</h1>
</main>
```

## Adjust syntax highlighting of Svelte files

The VS Code extension comes with its own syntax highlighting grammar which defines special scopes. If your syntax highlighting seems to be not working for Svelte components or you feel that some colors are wrong, you can add something like the following to your `settings.json`:

```
{
    "editor.tokenColorCustomizations": {
        "[<Name of your theme>]": {
            "textMateRules": [
                {
                    "settings": {
                        "foreground": "#569CD6", // any color you like
                    },
                    "scope": "support.class.component.svelte" // scope name you want to adjust highlighting for
                }
            ],
        },
    }
}
```

To find out the scope of the things you want to highlight differently, you can use the scope inspector by entering the command "Developer: Inspect Editor Tokens and Scopes". The scope at the top of the section "textmate scopes" is what you are looking for. The current color is in the section "foreground" - you can use this to look up colors of other scopes if you want them to be the same color but don't know the color-code.

For more info on customizing your theme, [see the VS Code docs](https://code.visualstudio.com/docs/getstarted/themes#_customizing-a-color-theme).

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

#### `export let ...` breaks my syntax highlighting

If you have the `Babel Javascript` plugin installed, this may be the cause. Disable it for Svelte files.

#### My Code does not get formatted

Your default formatter for Svelte files may be wrong.

-   Mabye it's set to the old Svelte extension, if so, remove the setting
-   Maybe you set all files to be formatted by the prettier extension. Then you have two options: Either install `prettier-plugin-svelte` from npm, or tell VSCode to format the code with the `Svelte for VSCode extension`:

```json
  "[svelte]": {
    "editor.defaultFormatter": "svelte.svelte-vscode"
  },
```

## Internals

-   [Notes about deployment](./internal/deployment.md)
-   [Overview of the language-tools and how things work together](./internal/overview.md)
