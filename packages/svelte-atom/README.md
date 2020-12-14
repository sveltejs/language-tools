# Svelte for Atom

Provides syntax highlighting and rich intellisense for Svelte components in Atom, utilising the [svelte language server](https://github.com/sveltejs/language-tools/).

## Features

-   Svelte
    -   Diagnostic messages for warnings and errors
    -   Support for svelte preprocessors that provide source maps
-   HTML
    -   Hover info
    -   Autocompletions
    -   [Emmet](https://emmet.io/)
    -   Formatting
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
    -   Diagnostics messages for syntax and semantic errors
    -   Hover info
    -   Formatting (via [prettier](https://github.com/prettier/prettier))
    -   Symbols in Outline panel

#### Language specific setup

-   [SCSS/Less](/packages/svelte-vscode/docs/preprocessors/scss.md)
-   [TypeScript](/packages/svelte-vscode/docs/preprocessors/typescript.md)

## See Also

-   [Svelte Language Server](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-language-server)
-   [Svelte VS Code](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode)

## Credits

-   [UnwrittenFun](https://github.com/UnwrittenFun) for creating the foundation which the official extensions are built on
-   Vue's [Vetur](https://github.com/vuejs/vetur) language server which heavily inspires this project
-   [halfnelson](https://github.com/halfnelson) for creating `svelte2tsx`
