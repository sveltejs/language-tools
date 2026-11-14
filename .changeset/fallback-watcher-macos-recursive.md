---
'svelte-language-server': patch
---

fix: use one recursive native watcher for the fallback file watcher on macOS so large workspaces no longer crash the server with EMFILE, and watch directories added through `watchDirectory`
