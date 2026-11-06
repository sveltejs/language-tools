---
'svelte-check': patch
---

fix: resolve `.svelte` files imported through package.json `imports` (e.g. `#lib/*`) with `--tsgo` / `--incremental`
