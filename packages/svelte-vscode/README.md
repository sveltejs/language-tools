# Svelte for VS Code

Provides syntax highlighting and rich intellisense for Svelte components in VS Code, utilising the [svelte language server](/packages/language-server).

## Setup

If you added `"files.associations": {"*.svelte": "html" }` to your VSCode settings, remove it.

If you have previously installed the old "Svelte" extension by James Birtles, uninstall it:

-   Through the UI: You can find it when searching for `@installed` in the extensions window (searching `Svelte` won't work).
-   Command line: `code --uninstall-extension JamesBirtles.svelte-vscode`

You need at least VSCode version `1.41.0`.

Do you want to use TypeScript/SCSS/Less/..? [See the docs](/docs/README.md#language-specific-setup).

More docs and troubleshooting: [See here](/docs/README.md).

## Features

-   Svelte
    -   Diagnostic messages for warnings and errors
    -   Support for svelte preprocessors that provide source maps
    -   Svelte specific formatting (via [prettier-plugin-svelte](https://github.com/sveltejs/prettier-plugin-svelte))
    -   A command to preview the compiled code (DOM mode): "Svelte: Show Compiled Code"
    -   A command to extract template content into a new component: "Svelte: Extract Component"
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

### Settings

##### `svelte.language-server.runtime`

Path to the node executable you would like to use to run the language server.
This is useful when you depend on native modules such as node-sass as without
this they will run in the context of vscode, meaning node version mismatch is likely.

##### `svelte.language-server.ls-path`

You normally don't set this. Path to the language server executable. If you installed the \"svelte-language-server\" npm package, it's within there at \"bin/server.js\". Path can be either relative to your workspace root or absolute. Set this only if you want to use a custom version of the language server.

##### `svelte.language-server.port`

You normally don't set this. At which port to spawn the language server.
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

##### `svelte.plugin.css.globals`

Which css files should be checked for global variables (`--global-var: value;`). These variables are added to the css completions. String of comma-separated file paths or globs relative to workspace root.

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

##### `svelte.plugin.svelte.compilerWarnings`

Svelte compiler warning codes to ignore or to treat as errors. Example: { 'css-unused-selector': 'ignore', 'unused-export-let': 'error'}

##### `svelte.plugin.svelte.format.enable`

Enable formatting for Svelte (includes css & js). _Default_: `true`

##### `svelte.plugin.svelte.hover.enable`

Enable hover info for Svelte (for tags like #if/#each). _Default_: `true`

##### `svelte.plugin.svelte.completions.enable`

Enable autocompletion for Svelte (for tags like #if/#each). _Default_: `true`

##### `svelte.plugin.svelte.rename.enable`

Enable rename functionality (rename svelte files or variables inside svelte files). _Default_: `true`

##### `svelte.plugin.svelte.codeActions.enable`

Enable code actions for Svelte. _Default_: `true`
