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

### Usage with Yarn 2 PnP

1. Run `yarn add -D svelte-language-server` to install svelte-language-server as a dev dependency
2. Run `yarn dlx @yarnpkg/sdks vscode` to generate or update the VSCode/Yarn integration SDKs. This also sets the `svelte.language-server.ls-path` and `svelte.language-server.runtime-args` setting for the workspace, pointing it to the workspace-installed language server. Note that this requires workspace trust - else set the `svelte.language-server.ls-path` and `svelte.language-server.runtime-args` setting in your user configuration.
3. Restart VSCode.
4. Commit the changes to `.yarn/sdks`

### Credits

-   The PostCSS grammar is based on [hudochenkov/Syntax-highlighting-for-PostCSS](https://github.com/hudochenkov/Syntax-highlighting-for-PostCSS)
