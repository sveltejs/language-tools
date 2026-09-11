---
'svelte2tsx': patch
'svelte-language-server': patch
---

perf: cache internal TypeScript ASTs with incremental reparsing

Use `ts.updateSourceFile()` instead of `ts.createSourceFile()` for repeated svelte2tsx calls on the same file. This reuses unchanged AST subtrees for ~27% faster svelte2tsx transforms on typical single-character edits.
