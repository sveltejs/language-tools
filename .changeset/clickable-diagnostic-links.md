---
'svelte-language-server': patch
---

feat: make links in diagnostic messages clickable

Convert URLs in Svelte compiler diagnostic messages to markdown links,
enabling users to click them directly in IDEs that support markdown in
diagnostics (e.g., VS Code after microsoft/vscode@166541c).
