---
'svelte2tsx': patch
---

fix: don't crash on array binding holes in destructured exports (e.g. `export let { d: [a, , c] } = obj`)
