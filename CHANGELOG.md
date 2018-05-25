# Changelog

## 0.4.1

*   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.4.2) 0.4.2
    *   Has better support for typescript in workspaces
*   Now actually bundles the lib.d.ts files from typescript.. 🤦

## 0.4.0

*   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.4.0) 0.4.0
    *   Includes fix to prevent attempting to load svelte config from package.json
    *   Switching language type (.e.g from `type=text/javascript` to `type=text/typescript`) no longer crashes the server

## 0.3.2

*   Allow space after key in each block ([#12](https://github.com/UnwrittenFun/svelte-vscode/issues/12))

## 0.3.1

*   Register .svelte extension ([#8](https://github.com/UnwrittenFun/svelte-vscode/pull/8))
*   Fix highlighting error when using object destructuring in each blocks ([#11](https://github.com/UnwrittenFun/svelte-vscode/issues/11))
*   Use correct comments in typescript and scss blocks

## 0.3.0

*   Add html tag autoclosing ([#4](https://github.com/UnwrittenFun/svelte-vscode/pull/4))
*   Fix incorrect comments being used for css and html ([#3](https://github.com/UnwrittenFun/svelte-vscode/issues/3))

## 0.2.0

*   Update to [svelte-language-server](https://github.com/UnwrittenFun/svelte-language-server/tree/v0.2.0) 0.2.0
*   Emmet abbreviations support for HTML and CSS ([#2](https://github.com/UnwrittenFun/svelte-vscode/issues/2))

## 0.1.0

*   Initial release
