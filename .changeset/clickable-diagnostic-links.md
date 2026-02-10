---
'svelte-language-server': patch
---

feat: add codeDescription for clickable error codes

Add codeDescription to Svelte diagnostics, enabling users to click error
codes to navigate directly to the Svelte compiler warnings documentation.
Uses the LSP 3.17 codeDescription API.
