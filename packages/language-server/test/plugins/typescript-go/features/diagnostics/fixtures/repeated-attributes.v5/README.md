`expectedv2.json` is what TS6 reports, plus one error TS6 misses: the second unknown `on:wat`.
For TS6, repeated attributes are duplicate properties of one object literal (1117, filtered
afterwards), and TypeScript checks only the first of them for excess properties. In content mapper
mode, svelte2tsx gives each repeated attribute its own `createElement` call, so each one is checked.
