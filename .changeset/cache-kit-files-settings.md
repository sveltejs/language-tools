---
'svelte-check': patch
---

perf: cache `svelte.config.js` settings in incremental manifest, avoiding a dynamic import on every warm `--incremental` run
