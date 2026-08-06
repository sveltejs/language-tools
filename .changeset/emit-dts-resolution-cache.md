---
'svelte2tsx': patch
---

perf: use a module resolution cache in emitDts, avoiding a full module resolution walk for every import of every file in the program
