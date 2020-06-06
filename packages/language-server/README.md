# Svelte Language Server

A language server (implementing the [language server protocol](https://microsoft.github.io/language-server-protocol/))
for Svelte.

Requires Node 12 or later.

## What is a language server?

From https://microsoft.github.io/language-server-protocol/overview

> The idea behind a Language Server is to provide the language-specific smarts inside a server that can communicate with development tooling over a protocol that enables inter-process communication.

In simpler terms, this allows editor and addon devs to add support for svelte specific 'smarts' (e.g. diagnostics, autocomplete, etc) to any editor without reinventing the wheel.

## Features

Svelte language server is under development and the list of features will surely grow over time.

Currently Supported:

-   Svelte
    -   Diagnostic messages for warnings and errors
    -   Svelte specific formatting (via [prettier-plugin-svelte](https://github.com/UnwrittenFun/prettier-plugin-svelte))
-   HTML (via [vscode-html-languageservice](https://github.com/Microsoft/vscode-html-languageservice))
    -   Hover info
    -   Autocompletions
    -   [Emmet](https://emmet.io/)
    -   Symbols in Outline panel
-   CSS / SCSS / LESS (via [vscode-css-languageservice](https://github.com/Microsoft/vscode-css-languageservice))
    -   Diagnostic messages for syntax and lint errors
    -   Hover info
    -   Autocompletions
    -   Formatting (via [prettier](https://github.com/prettier/prettier))
    -   [Emmet](https://emmet.io/)
    -   Color highlighting and color picker
    -   Symbols in Outline panel
-   TypeScript / JavaScript (via TypeScript)
    -   Diagnostics messages for syntax errors, semantic errors, and suggestions
    -   Hover info
    -   Formatting (via [prettier](https://github.com/prettier/prettier))
    -   Symbols in Outline panel
    -   Autocompletions
    -   Go to definition
    -   Code Actions

## How can I use it?

Install a plugin for your editor:

-   [VS Code](../svelte-vscode)

## Credits

-   [UnwrittenFun](https://github.com/UnwrittenFun) for creating the foundation which this language server is built on
-   Vue's [Vetur](https://github.com/vuejs/vetur) language server which heavily inspires this project
