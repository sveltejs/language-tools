# Check your code with Svelte-Check

Provides diagnostics for things such as

-   unused css
-   Svelte A11y hints
-   Javascript/Typescript diagnostics

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
