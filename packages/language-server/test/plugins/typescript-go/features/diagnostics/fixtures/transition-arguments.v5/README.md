`expectedv2.json` is what TS6 reports, plus errors TS6 misses, because it dropped "Expected 3 arguments"
for transitions that require a third parameter (and with that error TypeScript doesn't check the
arguments either). In content mapper mode, svelte2tsx passes what Svelte passes instead:
`{ direction: 'in' | 'out' | 'both' }` as the third argument (`__sveltets_2_transitionRest`). So TS7
also reports:

-   the wrong `delay` in `<div in:three={{ delay: 'no' }} />`
-   `<div in:wrongOptions={{ delay: 1 }} />`: its third parameter isn't Svelte's `{ direction }`

Known differences (not handled): the options type is Svelte's declared union, so a function that
narrows it (e.g. `{ direction: 'in' }`) is an error under any directive; and for an overloaded
transition function, the last overload decides whether the third argument is passed.
