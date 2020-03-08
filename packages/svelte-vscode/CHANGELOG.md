# Changelog

## 0.9.3

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/releases/v0.10.3) 0.10.3
    -   Don't trigger autocompletion in css when typing {
    -   Debounce diagnostics requests to improve diagnostic performance
-   Document settings and preprocessor configuration

## 0.9.2

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/releases/v0.10.2) 0.10.2
    -   Update to [prettier-plugin-svelte](https://github.com/UnwrittenFun/prettier-plugin-svelte/releases/tag/v0.7.0) 0.7.0
        -   Added strict html mode with option `svelte-strict-mode`
        -   Added support for await block shorthand
        -   Now handles multiple script and style tags
        -   HTML entities (e.g. &amp;) will be kept as is in svelte > 3.4.3
        -   New option `svelteBracketNewLine` to add a new line before closing `>` when wrapping attributes
        -   Added support for all known svelte:\* elements
        -   Added support for local modifier on transitions
        -   Fixed if inside of each else blocks erroneously being converted to and else if block
        -   Added sort order option to change order of script/style/markup available as `svelte-sort-order`
        -   Fix some whitespace issues with inline tags

## 0.9.1

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/releases/v0.10.1) 0.10.1
    -   Update to [prettier-plugin-svelte](https://github.com/UnwrittenFun/prettier-plugin-svelte/releases/tag/v0.5.1) 0.5.1
        -   Better attribute wrapping
-   No longer opens output panel on error

## 0.9.0

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.10.0) 0.10.0
    -   Adds suggestion diagnostics for typescript/javascript
    -   Add code actions to typescript/javascript
    -   Add go to definition support for typescript/javascript
    -   Fix emmet completions showing up inconsistently
    -   Update to [prettier-plugin-svelte](https://github.com/UnwrittenFun/prettier-plugin-svelte/releases/tag/v0.5.0) 0.5.0
        -   Adds better whitespace support
        -   Adds support for all utf8 characters in styles and scripts
        -   Support event modifiers
        -   Support let and class bindings
-   .html files are no longer associated to this plugin by default

## 0.8.0

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.8.0) 0.8.0
    -   No longer applies semantic validation to JavaScript blocks (only syntactic).
    -   Add autocompletions to js/ts
    -   Formatting is now provided by [prettier-plugin-svelte](https://github.com/UnwrittenFun/prettier-plugin-svelte)
        which gives much improved support for svelte specific syntax and fixes a number of issues with the previous setup

## 0.7.1

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.7.1) 0.7.1
    -   Fix for breaking changes in svelte v3

## 0.7.0

-   Support for Svelte v3
-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.7.0) 0.7.0
    -   Svelte is now loaded from your project when possible
    -   Updates to various packages

## 0.6.1

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.6.1) 0.6.1
    -   Includes some minor bug fixes

## 0.6.0

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.6.0) 0.6.0
    -   Add symbols in the outline panel for css, html, and typescript
    -   Add html formatting
    -   Add color information and color picker to css
-   Add support for lang attribute on style and script tags

## 0.5.0

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.5.0) 0.5.0
-   Add config options for all features provided by the language server

## 0.4.2

-   Add command to restart language server (useful if it errors or is using stale data)
    -   Access it using `Cmd-Shift-P` or `Ctrl-Shift-P` and typing "restart language server"

## 0.4.1

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.4.2) 0.4.2
    -   Has better support for typescript in workspaces
-   Now actually bundles the lib.d.ts files from typescript.. 🤦

## 0.4.0

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.4.0) 0.4.0
    -   Includes fix to prevent attempting to load svelte config from package.json
    -   Switching language type (.e.g from `type=text/javascript` to `type=text/typescript`) no longer crashes the server

## 0.3.2

-   Allow space after key in each block ([#12](https://github.com/UnwrittenFun/svelte-vscode/issues/12))

## 0.3.1

-   Register .svelte extension ([#8](https://github.com/UnwrittenFun/svelte-vscode/pull/8))
-   Fix highlighting error when using object destructuring in each blocks ([#11](https://github.com/UnwrittenFun/svelte-vscode/issues/11))
-   Use correct comments in typescript and scss blocks

## 0.3.0

-   Add html tag autoclosing ([#4](https://github.com/UnwrittenFun/svelte-vscode/pull/4))
-   Fix incorrect comments being used for css and html ([#3](https://github.com/UnwrittenFun/svelte-vscode/issues/3))

## 0.2.0

-   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.2.0) 0.2.0
-   Emmet abbreviations support for HTML and CSS ([#2](https://github.com/UnwrittenFun/svelte-vscode/issues/2))

## 0.1.0

-   Initial release
