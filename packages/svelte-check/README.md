# Check your code with svelte-check

Provides diagnostics for things such as

-   unused css
-   Svelte A11y hints
-   JavaScript/TypeScript diagnostics

### Usage:

#### Global

Installation:

`npm i svelte-check -g`

Usage:

1. Go to folder where to start checking
2. `svelte-check`

#### Local / in your project

Installation:

`npm i svelte-check --save-dev`

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

### Args:

`--workspace <path to your workspace, where checking starts>`

`--output <human|human-verbose|machine>`

### Machine-Readable Output

Setting the `--output` to `machine` will format output in a way that is easier to read
by machines, e.g. inside CI pipelines, for code quality checks, ets.

Each row corresponds to a new record. Rows are made up of columns that are separated by a
single space character. The first column of every row contains a timestamp in milliseconds
which can be used for monitoring purposes. The second columns gives us the "row type", based
on which the number and types of subsequent columns may differ.

The first row is of type `START` and contains the workspace folder (wrapped in quotes).

Example:

```
1590680325583 START "/home/user/language-tools/packages/language-server/test/plugins/typescript/testfiles"
```

Any number of `ERROR` or `WARNING` records may follow. Their structure is identical and tells
us the filename, the line and column numbers, and the error message. The filename is relative
to the workspace directory. The filename and the message are both wrapped in quotes.

Example:

```
1590680326283 ERROR "codeactions.svelte" 1:16 "Cannot find module 'blubb' or its corresponding type declarations."
1590680326778 WARNING "imported-file.svelte" 0:37 "Component has unused export property 'prop'. If it is for external reference only, please consider using `export const prop`"
```

The output concludes with a `COMPLETED` message that summarizes total numbers of files, errors,
and warnings that were encountered during the check.

Example:

```
1590680326807 COMPLETED 20 FILES 21 ERRORS 1 WARNINGS
```

If the application experiences a runtime error, this error will appear as a `FAILURE` record.

Example:

```
1590680328921 FAILURE "Connection closed"
```
