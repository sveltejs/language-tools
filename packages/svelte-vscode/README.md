# Svelte for VS Code

Provides syntax highlighting and rich intellisense for Svelte components in VS Code, using the [svelte language server](/packages/language-server).

## Setup

If you added `"files.associations": {"*.svelte": "html" }` to your VSCode settings, remove it.

If you have previously installed the old "Svelte" extension by James Birtles, uninstall it:

-   Through the UI: You can find it when searching for `@installed` in the extensions window (searching `Svelte` won't work).
-   Command line: `code --uninstall-extension JamesBirtles.svelte-vscode`

This extension comes bundled with a formatter for Svelte files. To let this extension format Svelte files, adjust your VS Code settings:

```
   "[svelte]": {
     "editor.defaultFormatter": "svelte.svelte-vscode"
   },
```

The formatter is a [Prettier](https://prettier.io/) [plugin](https://prettier.io/docs/en/plugins.html), which means some formatting options of Prettier apply. There are also Svelte specific settings like the sort order of scripts, markup, styles. More info about them and how to configure it can be found [here](https://github.com/sveltejs/prettier-plugin-svelte).

You need at least VSCode version `1.52.0`.

Do you want to use TypeScript/SCSS/Less/..? [See the docs](/docs/README.md#language-specific-setup).

More docs and troubleshooting: [See here](/docs/README.md).

## Features

You can expect the following within Svelte files:

-   Diagnostic messages
-   Support for svelte preprocessors that provide source maps
-   Formatting (via [prettier-plugin-svelte](https://github.com/sveltejs/prettier-plugin-svelte))
-   A command to preview the compiled code (DOM mode): "Svelte: Show Compiled Code"
-   A command to extract template content into a new component: "Svelte: Extract Component"
-   Hover info
-   Autocompletions
-   [Emmet](https://emmet.io/)
-   Symbols in outline panel
-   CSS Color highlighting and color picker
-   Go to definition
-   Code Actions

The extension also comes packaged with a TypeScript plugin, which when activated provides intellisense within JavaScript and TypeScript files for interacting with Svelte files.

### Settings

##### `svelte.enable-ts-plugin`

Enables a TypeScript plugin which provides intellisense for Svelte files inside TS/JS files. _Default_: `false`

##### `svelte.language-server.runtime`

Path to the node executable you would like to use to run the language server.
This is useful when you depend on native modules such as node-sass as without this they will run in the context of vscode, meaning node version mismatch is likely.
Minimum required node version is `12.17`.
This setting can only be changed in user settings for security reasons.

##### `svelte.language-server.ls-path`

You normally don't set this. Path to the language server executable. If you installed the `svelte-language-server` npm package, it's within there at `bin/server.js`. Path can be either relative to your workspace root or absolute. Set this only if you want to use a custom version of the language server. This will then also use the workspace version of TypeScript.
This setting can only be changed in user settings for security reasons.

#### `svelte.language-server.runtime-args`

You normally don't set this. Additional arguments to pass to Node when spawning the language server.
This is useful when you use something like Yarn PnP and need its loader arguments `["--loader", ".pnp.loader.mjs"]`.

##### `svelte.language-server.port`

You normally don't set this. At which port to spawn the language server.
Can be used for attaching to the process for debugging / profiling.
If you experience crashes due to "port already in use", try setting the port.
-1 = default port is used.

##### `svelte.trace.server`

Traces the communication between VS Code and the Svelte Language Server. _Default_: `off`

Value can be `off`, `messages`, or `verbose`.
You normally don't set this. Can be used in debugging language server features.
If enabled you can see the logging in the output channel near the integrated terminal.

##### `svelte.plugin.XXX`

Settings to toggle specific features of the extension. The full list of all settings [is here](/packages/language-server/README.md#List-of-settings).

### TypeScript 7 (experimental)

With the TypeScript 7 extension (`TypeScriptTeam.native-preview` 1.0.2 or newer) and `js/ts.experimental.useTsgo` turned on, TypeScript 7 can serve the TypeScript features of Svelte files itself, through the content mapper `@sveltejs/ts-content-mapper`. This needs a TypeScript 7.1 or higher as the TypeScript 7 server, the package installed in the project, TypeScript 7.1 or higher installed in the project as well (`typescript@^7.1` as `typescript`, or as `@typescript/native` next to an older `typescript`; the content mapper parses with it and reports an error on each Svelte file if it finds none), and this registration in the tsconfig:

```jsonc
"contentMappers": [{ "package": "@sveltejs/ts-content-mapper" }]
```

The Svelte language server then turns its own TypeScript features off and keeps the Svelte, HTML and CSS ones.

#### Differences in TypeScript 7 mode

-   Formatting: the TypeScript 7 extension also registers a formatter for Svelte files (it does not format them), so VS Code may ask which one to use; set `"[svelte]": { "editor.defaultFormatter": "svelte.svelte-vscode" }` in your settings.

-   Updating imports when renaming or moving files: TypeScript 7 updates the imports in `.ts`/`.js` files; the imports in Svelte files are updated by this extension. It searches the projects TypeScript 7 has loaded (not the whole workspace) and only updates relative imports (not aliases like `$lib/…`, nor imports with a query like `?raw`).
-   SvelteKit route files (`+page.ts` etc.) are not typed implicitly: TypeScript 7 does not let a content mapper change `.ts` files. Annotate them with the generated types, e.g. `export const load: PageLoad = …` with `import type { PageLoad } from './$types'`.
-   TypeScript 7 offers fewer quick fixes and refactorings than TypeScript 6 (for now mainly adding imports).

#### How the mode is decided

The decision is made for the whole workspace (it is assumed to be either all TypeScript 7 or all TypeScript 6), when the Svelte language server starts: if a `tsconfig*.json` or `jsconfig*.json` of the workspace folders (without `node_modules` and folders starting with `.`) mentions `contentMappers` and `svelte`, TypeScript 7 serves the TypeScript features of Svelte files. Changes to these files are picked up automatically.

Known limits:

-   A registration that is only inherited through `extends` from a file with another name (e.g. `base.json`), from `.svelte-kit/tsconfig.json` or from a package is not found. Put it into a `tsconfig*.json`/`jsconfig*.json` of the workspace.
-   TypeScript 7 only loads content mappers from a `node_modules` inside an open workspace folder. In a monorepo with a hoisted `node_modules`, open the monorepo root. TypeScript 7 reads the workspace folders when its server starts, so after adding a folder, restart the TypeScript 7 server.

### Usage with Yarn 2 PnP

1. Run `yarn add -D svelte-language-server` to install svelte-language-server as a dev dependency
2. Run `yarn dlx @yarnpkg/sdks vscode` to generate or update the VSCode/Yarn integration SDKs. This also sets the `svelte.language-server.ls-path` and `svelte.language-server.runtime-args` setting for the workspace, pointing it to the workspace-installed language server. Note that this requires workspace trust - else set the `svelte.language-server.ls-path` and `svelte.language-server.runtime-args` setting in your user configuration.
3. Restart VSCode.
4. Commit the changes to `.yarn/sdks`

### Credits

-   The PostCSS grammar is based on [hudochenkov/Syntax-highlighting-for-PostCSS](https://github.com/hudochenkov/Syntax-highlighting-for-PostCSS)
