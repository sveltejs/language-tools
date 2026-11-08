# Check your code with svelte-check

`svelte-check` finds errors and warnings in your project, such as:

-   unused CSS
-   accessibility hints
-   JavaScript/TypeScript compiler errors

Requires Node 16 or later.

## Installation

You will need to have the `svelte-check` package installed in your project:

```sh
npm i -D svelte-check
```

## Usage

### Local / in your project

Installation:

```sh
npx svelte-check
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

### Global (not recommended)

Installation:

```sh
npm i svelte-check svelte -g
```

Usage:

1. Go to the folder where you want to start checking
2. `svelte-check`

## TypeScript 7 support

TypeScript 7 support currently requires the `--tsgo` or `--tsgo-experimental-api` flag. You need to install both TypeScript 7 and TypeScript 6.

You can setup both versions with an npm alias:

```sh
npm install --save-dev typescript@~6 @typescript/native@npm:typescript@7
```

## Options

| Flag                                                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--workspace <path>`                                            | Path to your workspace. All subdirectories except `node_modules` and those listed in `--ignore` are checked                                                                                                                                                                                                                                                                                                                         |
| `--config <path>`                                               | Pass a path to a `svelte.config` or `vite.config` file. The path can be relative to the workspace path or absolute. Use this when your config file has a non-standard name or location. This also turns off discovery of Svelte config files below the given path.                                                                                                                                                                  |
| `--output <human\|human-verbose\|machine\|machine-verbose>`     | How to display errors and warnings. See [machine-readable output](#machine-readable-output) for `machine` and `machine-verbose`.                                                                                                                                                                                                                                                                                                    |
| `--watch`                                                       | Keeps the process alive and watches for changes, rerunning diagnostics                                                                                                                                                                                                                                                                                                                                                              |
| `--preserveWatchOutput`                                         | Do not clear the screen in watch mode                                                                                                                                                                                                                                                                                                                                                                                               |
| `--tsconfig <path>`                                             | Pass a path to a `tsconfig` or `jsconfig` file. The path can be relative to the workspace path or absolute. Doing this means that only files matched by the `files`/`include`/`exclude` pattern of the config file are diagnosed. It also means that errors from TypeScript and JavaScript files are reported. If not given, will traverse upwards from the project directory looking for the next `jsconfig.json`/`tsconfig.json`. |
| `--no-tsconfig`                                                 | Use this if you only want to check the Svelte files found in the current directory and below and ignore any JS/TS files (they will not be type-checked)                                                                                                                                                                                                                                                                             |
| `--ignore <path1,path2>`                                        | Can only be used in conjunction with `--no-tsconfig`. Files/folders to ignore — relative to workspace root, comma-separated, inside quotes. Example: `--ignore "dist,build"`.                                                                                                                                                                                                                                                       |
| `--fail-on-warnings`                                            | Will also exit with error code when there are warnings                                                                                                                                                                                                                                                                                                                                                                              |
| `--compiler-warnings <code1:error\|ignore,code2:error\|ignore>` | A list of Svelte compiler warning codes (see the [compiler warning docs](https://svelte.dev/docs/svelte/compiler-warnings)). Each entry defines whether that warning should be ignored or treated as an error. Warnings are comma-separated, between warning code and error level is a colon; all inside quotes. Example: `--compiler-warnings "css_unused_selector:ignore,a11y_missing_attribute:error"`                           |
| `--diagnostic-sources <js,svelte,css>`                          | A list of diagnostic sources which should run diagnostics on your code. Possible values are `js` (includes TypeScript), `svelte`, `css`. Comma-separated, inside quotes. By default all are active. Example: `--diagnostic-sources "js,svelte"`                                                                                                                                                                                     |
| `--threshold <error\|warning>`                                  | Filters the diagnostics to display. `error` will output only errors while `warning` (default) will output warnings and errors.                                                                                                                                                                                                                                                                                                      |
| `--incremental`                                                 | Opts into TypeScript's incremental build cache, which speeds up subsequent runs. Saved within `.svelte-kit` or if not available within `.svelte-check`. This might result in slightly different type check outcomes, and certain patterns are not supported. Specifically, anything that is not in the root dir of your tsconfig.json and is a Svelte file will not be properly loaded and type-checked.                            |
| `--tsgo`                                                        | Use TypeScript's Go implementation. Needs `@typescript/native` installed (see [TypeScript 7 support](#typescript-7-support)). Subject to the same limitations as `--incremental`.                                                                                                                                                                                                                                                   |
| `--color`                                                       | Force enabling of color output.                                                                                                                                                                                                                                                                                                                                                                                                     |

## FAQ

### Why is there no option to only check specific files (for example only staged files)?

`svelte-check` needs to 'see' the whole project for checks to be valid. Suppose you renamed a component prop but didn't update any of the places where the prop is used — the usage sites are all errors now, but you would miss them if checks only ran on changed files.

## More docs, preprocessor setup and troubleshooting

[See here](/docs/README.md).

## Machine-Readable Output

Setting the `--output` to `machine` or `machine-verbose` will format output in a way that is easier to read by machines, e.g. inside CI pipelines, for code quality checks, etc.

Each row corresponds to a new record. Rows are made up of columns that are separated by a single space character. The first column of every row contains a timestamp in milliseconds which can be used for monitoring purposes. The second column gives us the "row type", based on which the number and types of subsequent columns may differ.

The first row is of type `START` and contains the workspace folder (wrapped in quotes).

### Example:

```
1590680325583 START "/home/user/language-tools/packages/language-server/test/plugins/typescript/testfiles"
```

Any number of `ERROR` or `WARNING` records may follow. Their structure is identical and depends on the output argument.

If the argument is `machine` it will tell us the filename, the starting line and column numbers, and the error message. The filename is relative to the workspace directory. The filename and the message are both wrapped in quotes.

### Example:

```
1590680326283 ERROR "codeactions.svelte" 1:16 "Cannot find module 'blubb' or its corresponding type declarations."
1590680326778 WARNING "imported-file.svelte" 0:37 "Component has unused export property 'prop'. If it is for external reference only, please consider using `export const prop`"
```

If the argument is `machine-verbose` it will tell us the filename, the starting line and column numbers, the ending line and column numbers, the error message, the code of diagnostic, the human-friendly description of the code and the human-friendly source of the diagnostic (eg. svelte/typescript). The filename is relative to the workspace directory. Each diagnostic is represented as an [ndjson](https://en.wikipedia.org/wiki/JSON_streaming#Newline-Delimited_JSON) line prefixed by the timestamp of the log.

### Example:

```
1590680326283 {"type":"ERROR","fn":"codeaction.svelte","start":{"line":1,"character":16},"end":{"line":1,"character":23},"message":"Cannot find module 'blubb' or its corresponding type declarations.","code":2307,"source":"js"}
1590680326778 {"type":"WARNING","filename":"imported-file.svelte","start":{"line":0,"character":37},"end":{"line":0,"character":51},"message":"Component has unused export property 'prop'. If it is for external reference only, please consider using `export
const prop`","code":"unused-export-let","source":"svelte"}
```

The output concludes with a `COMPLETED` message that summarizes total numbers of files, errors and warnings that were encountered during the check.

### Example:

```
1590680326807 COMPLETED 20 FILES 21 ERRORS 1 WARNINGS 3 FILES_WITH_PROBLEMS
```

If the application experiences a runtime error, this error will appear as a `FAILURE` record.

### Example:

```
1590680328921 FAILURE "Connection closed"
```

## Credits

-   Vue's [VTI](https://github.com/vuejs/vetur/tree/master/vti) which laid the foundation for `svelte-check`
