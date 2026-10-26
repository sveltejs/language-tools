---
'svelte-check': patch
---

Report a tsconfig parse error instead of an internal error on `--incremental` and `--tsgo` runs when the tsconfig path is not normalized.
