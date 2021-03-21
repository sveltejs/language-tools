# SourceMapping tests

## How to add a new sample

    1) Create a folder with a svelte file (e.g. "input.svelte")
    2) Run tests
    3) Surround [[[text]]] with brackets in the newly generated `test.edit.jsx` file to test its mappings
    4) Run tests

## Tracked Files

    - `*.svelte` : input
    - `mappings.jsx` : (auto-generated) describes every mapping in detail to highlight changes for code review
    - `test.jsx` : (auto-generated) asserts mappings of ranges in the generated text

### Untracked Files

    - `test.edit.jsx` : used to edit a sample's tested ranges
    - `output.tsx` : for debug purposes, a standalone file for sourcemapping tools (e.g. https://evanw.github.io/source-map-visualization/)

Untracked files are only generated for new samples, on test error, mapping change or missing file
