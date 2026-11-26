# Check your code with svelte-check

Provides CLI diagnostics checks for:

-   Unused CSS
-   Svelte A11y hints
-   JavaScript/TypeScript compiler errors

Requires Node 18 or later.

### Usage:

#### Local / in your project

Installation:

```sh
npm i svelte-check --save-dev
```

Package.json:

```json
{
    // ...
    "scripts": {
        "svelte-check": "svelte-check"
        // ...
    },
    // ...
    "devDependencies": {
        "svelte-check": "..."
        // ...
    }
}
```

Usage:

`npm run svelte-check`

#### Global (not recommended)

Installation:

```sh
npm i svelte-check svelte -g
```

Usage:

1. Go to folder where to start checking
2. `svelte-check`

### TypeScript 7 (experimental)

With TypeScript 7.1 as your project's `typescript`, svelte-check checks your project with TypeScript 7.1. With TypeScript 7.1 installed next to TypeScript 5 or 6, `svelte-check --experimental-ts7` does. TypeScript 7.1 isn't released yet, and this support is experimental: results can differ from the default mode, and they can change with the TypeScript 7.1 build you use.

TypeScript 7 has no JavaScript compiler API, which the default mode of svelte-check needs. Instead, TypeScript 7.1 checks `.svelte` files itself, with a _content mapper_: [`@sveltejs/ts-content-mapper`](https://github.com/sveltejs/language-tools/tree/master/packages/typescript-content-mapper), which you register in your tsconfig. svelte-check runs TypeScript 7.1 through its API, adds the Svelte compiler and CSS diagnostics, and filters the results like the default mode does.

#### Requirements

-   Svelte 5
-   TypeScript 7.1 or higher (tested with `7.1.0-dev.20261125.1`). TypeScript 7.0 has no content mappers and doesn't work.
-   `@sveltejs/ts-content-mapper`, registered in your tsconfig (see [below](#tsconfig))
-   Node.js 20.16 or later: TypeScript 7's API, which svelte-check and the content mapper use, needs it

#### Installation

TypeScript 7.1 as your project's `typescript`:

```sh
npm install --save-dev svelte-check typescript@^7.1 @sveltejs/ts-content-mapper
```

Then plain `svelte-check` uses the TypeScript 7 support, as its default mode can't run with TypeScript 7.

Or, if other tools of your project still need TypeScript 6 (or 5) as `typescript`, TypeScript 7.1 next to it under the npm alias `@typescript/native`, and run `svelte-check --experimental-ts7`:

```sh
npm install --save-dev svelte-check typescript@^6 @typescript/native@npm:typescript@^7.1 @sveltejs/ts-content-mapper
```

The content mapper parses your scripts with the same TypeScript 7.1. TypeScript 7.0 as `typescript` works in neither mode, and svelte-check stops with an error.

#### tsconfig

Add the content mapper to the tsconfig that includes your Svelte files, at the top level next to `"compilerOptions"`:

```jsonc
{
    "compilerOptions": {
        // ...
    },
    "contentMappers": [{ "package": "@sveltejs/ts-content-mapper" }]
}
```

Also make sure that its `include` (or `files`) covers your Svelte files. TypeScript only checks the Svelte files that are part of a program, as in the default mode, and without a content mapper for `.svelte` it silently leaves them out.

#### Usage

```sh
svelte-check                    # TypeScript 7.1 as `typescript`
svelte-check --experimental-ts7 # TypeScript 7.1 as `@typescript/native`
```

svelte-check prints `svelte-check: experimental TypeScript 7 support, with TypeScript <version> (<package>)` to stderr when it uses the TypeScript 7 support. It needs a tsconfig/jsconfig (the one found next to or above the workspace, or `--tsconfig`) and works with `--watch`. It can't be combined with `--no-tsconfig`, `--incremental`, `--tsgo` or `--tsgo-experimental-api`; with TypeScript 7.1 as `typescript`, these options are an error, too.

#### Known limitations

-   **Svelte 5 only.**
-   **SvelteKit's implicit types for route files are not applied.** In the default mode, svelte-check types the exports of files like `+page.ts`, `+layout.ts`, `+server.ts` and `hooks.server.ts` without annotations (for example the parameter of `load` or of a `GET` handler). Content mappers can only transform `.svelte` files, not `.ts` files, so with TypeScript 7 these exports are untyped: with `strict`, you get errors like "Binding element 'params' implicitly has an 'any' type" (7031), and type errors that depend on the implicit types are missed. Annotate them instead, e.g. `export const load: PageLoad = ...` with `import type { PageLoad } from './$types'`.
-   **Imports of `.svelte` files that don't exist are only reported for `import` and `export ... from` statements.** Svelte's types declare all `*.svelte` modules (`declare module '*.svelte'`), which TypeScript 7 uses when such an import can't be resolved, so TypeScript itself (and plain `tsc`) doesn't report it. svelte-check adds the "Cannot find module" error (2307) for these statements, in Svelte and TS/JS files, but not for a dynamic `import('./Missing.svelte')` or an `import('./Missing.svelte')` type, which the default mode reports, too. As in TypeScript, nothing is reported in JavaScript files that aren't type-checked, and nothing if your project declares `*.svelte` modules itself. Declaration files (`.d.ts`) aren't searched for such imports, even with `skipLibCheck: false`.
-   Diagnostics in code that svelte-check generates for Svelte files are mapped back differently than in the default mode, so a few messages and positions differ. If you find a difference that looks wrong, please [open an issue](https://github.com/sveltejs/language-tools/issues).

#### Legacy TypeScript 7 flags

`--tsgo` and `--tsgo-experimental-api` predate content mappers. They need TypeScript 5 or 6 as `typescript` and TypeScript 7 as `@typescript/native` (or `@typescript/native-preview`), check Svelte files through svelte2tsx output generated by svelte-check, and don't support content mappers. Prefer `--experimental-ts7` with TypeScript 7.1.

### Args:

| Flag                                                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--workspace <path>`                                            | Path to your workspace. All subdirectories except node_modules and those listed in `--ignore` are checked                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `--config <path>`                                               | Pass a path to a `svelte.config` or `vite.config` file. The path can be relative to the workspace path or absolute. Use this when your config file has a non-standard name or location. This also turns off discovery of Svelte config files below the given path.                                                                                                                                                                                                                                                               |
| `--output <human\|human-verbose\|machine\|machine-verbose>`     |
| `--watch`                                                       | Will not exit after one pass but keep watching files for changes and rerun diagnostics                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `--preserveWatchOutput`                                         | Do not clear the screen in watch mode                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `--tsconfig <path>`                                             | Pass a path to a tsconfig or jsconfig file. The path can be relative to the workspace path or absolute. Doing this means that only files matched by the files/include/exclude pattern of the config file are diagnosed. It also means that errors from TypeScript and JavaScript files are reported. If not given, will do an upwards traversal looking for the next jsconfig/tsconfig.json                                                                                                                                      |
| `--no-tsconfig`                                                 | Use this if you only want to check the Svelte files found in the current directory and below and ignore any JS/TS files (they will not be type-checked)                                                                                                                                                                                                                                                                                                                                                                          |
| `--ignore <path1,path2>`                                        | Can only be used in conjunction with `--no-tsconfig`. Files/folders to ignore - relative to workspace root, comma-separated, inside quotes. Example: `--ignore "dist,build"`.                                                                                                                                                                                                                                                                                                                                                    |
| `--fail-on-warnings`                                            | Will also exit with error code when there are warnings                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `--compiler-warnings <code1:error\|ignore,code2:error\|ignore>` | A list of Svelte compiler warning codes. Each entry defines whether that warning should be ignored or treated as an error. Warnings are comma-separated, between warning code and error level is a colon; all inside quotes. Example: `--compiler-warnings "css-unused-selector:ignore,unused-export-let:error"`                                                                                                                                                                                                                 |
| `--diagnostic-sources <js,svelte,css>`                          | A list of diagnostic sources which should run diagnostics on your code. Possible values are `js` (includes TS), `svelte`, `css`. Comma-separated, inside quotes. By default all are active. Example: `--diagnostic-sources "js,svelte"`                                                                                                                                                                                                                                                                                          |
| `--threshold <error\|warning>`                                  | Filters the diagnostics to display. `error` will output only errors while `warning` will output warnings and errors.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `--experimental-ts7`                                            | Experimental: check with TypeScript 7.1 and the Svelte content mapper. Implied when `typescript` is TypeScript 7.1 or newer; needed when TypeScript 7.1 is installed as `@typescript/native`. See [TypeScript 7 (experimental)](#typescript-7-experimental).                                                                                                                                                                                                                                                                     |
| `--incremental`                                                 | Legacy. Opts into TypeScript's incremental build cache, which speeds up subsequent runs: svelte-check writes the svelte2tsx output of your Svelte files to `.svelte-kit` or if not available `.svelte-check`, and checks it with the `tsc` of TypeScript 5 or 6 (`typescript`). This might result in slightly different type check outcomes, and certain patterns are not supported. Specifically, anything that is not in the root dir of your tsconfig.json and is a Svelte file will not be properly loaded and type-checked. |
| `--tsgo`                                                        | Legacy. Like `--incremental`, but checks with the `tsc` of TypeScript 7 installed as `@typescript/native` (or `@typescript/native-preview`); TypeScript 5 or 6 is still needed as `typescript`. Subject to the same limitations as `--incremental`. For TypeScript 7.1, use `--experimental-ts7` instead.                                                                                                                                                                                                                        |
| `--tsgo-experimental-api`                                       | Legacy. TypeScript diagnostics from TypeScript 7 installed as `@typescript/native` through its API, with TypeScript 5 or 6 still needed as `typescript`. Doesn't support content mappers. For TypeScript 7.1, use `--experimental-ts7` instead.                                                                                                                                                                                                                                                                                  |

### FAQ

#### Why is there no option to only check specific files (for example only staged files)?

`svelte-check` needs to know the whole project to do valid checks. Imagine you alter a component property `export let foo` to `export let bar`, but you don't update any of the component usages. They all have errors now but you would not catch them if you only run checks on changed files.

### More docs, preprocessor setup and troubleshooting

[See here](/docs/README.md).

### Machine-Readable Output

Setting the `--output` to `machine` or `machine-verbose` will format output in a way that is easier to read
by machines, e.g. inside CI pipelines, for code quality checks, etc.

Each row corresponds to a new record. Rows are made up of columns that are separated by a
single space character. The first column of every row contains a timestamp in milliseconds
which can be used for monitoring purposes. The second column gives us the "row type", based
on which the number and types of subsequent columns may differ.

The first row is of type `START` and contains the workspace folder (wrapped in quotes).

###### Example:

```
1590680325583 START "/home/user/language-tools/packages/language-server/test/plugins/typescript/testfiles"
```

Any number of `ERROR` or `WARNING` records may follow. Their structure is identical and depends on the output argument.

If the argument is `machine` it will tell us the filename, the starting line and column numbers, and the error message. The filename is relative to the workspace directory. The filename and the message are both wrapped in quotes. Line and column numbers are 1-based.

###### Example:

```
1590680326283 ERROR "codeactions.svelte" 2:17 "Cannot find module 'blubb' or its corresponding type declarations."
1590680326778 WARNING "imported-file.svelte" 1:38 "Component has unused export property 'prop'. If it is for external reference only, please consider using `export const prop`"
```

If the argument is `machine-verbose` it will tell us the filename, the starting line and column numbers, the ending line and column numbers, the error message, the code of diagnostic, the human-friendly description of the code and the human-friendly source of the diagnostic (eg. svelte/typescript). The filename is relative to the workspace directory. Each diagnostic is represented as an [ndjson](https://en.wikipedia.org/wiki/JSON_streaming#Newline-Delimited_JSON) line prefixed by the timestamp of the log. Unlike in the `machine` output, line and character numbers are 0-based, as in the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#position).

###### Example:

```
1590680326283 {"type":"ERROR","filename":"codeactions.svelte","start":{"line":1,"character":16},"end":{"line":1,"character":23},"message":"Cannot find module 'blubb' or its corresponding type declarations.","code":2307,"source":"js"}
1590680326778 {"type":"WARNING","filename":"imported-file.svelte","start":{"line":0,"character":37},"end":{"line":0,"character":51},"message":"Component has unused export property 'prop'. If it is for external reference only, please consider using `export
const prop`","code":"unused-export-let","source":"svelte"}
```

The output concludes with a `COMPLETED` message that summarizes total numbers of files, errors and warnings that were encountered during the check.

###### Example:

```
1590680326807 COMPLETED 20 FILES 21 ERRORS 1 WARNINGS 3 FILES_WITH_PROBLEMS
```

If the application experiences a runtime error, this error will appear as a `FAILURE` record.

###### Example:

```
1590680328921 FAILURE "Connection closed"
```

### Credits

-   Vue's [VTI](https://github.com/vuejs/vetur/tree/master/vti) which laid the foundation for `svelte-check`
