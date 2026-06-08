---
"svelte-check": patch
---

Fix `svelte-check` silently emitting zero virtual files when the workspace lives under any dot-prefixed ancestor directory (e.g. `.local/`, `.config/`, custom worktree directories). The directory exclusion in `findFiles()` now matches by directory name instead of full path, so ancestors of the workspace are no longer treated as hidden.
