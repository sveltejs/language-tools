`expectedv2.json` is not what TS6 reports: TS6 drops template comments, so it reports all property
errors. In content mapper mode, `<!-- @ts-expect-error -->` and `<!-- @ts-ignore -->` work like
TypeScript's comment directives (svelte2tsx emits them as TypeScript comments, mapped to the HTML
comment): the errors below them are gone, and the unused `@ts-expect-error` is reported on its HTML
comment. The errors below the ordinary comment and below the inline directive stay.

The feature is line-based, as in TypeScript and JSX: a directive applies to the errors on the next
line of the template (with only blank or comment lines between), not to a whole multi-line element,
its children or the body of a block, and it covers every element on that line. Only a comment that
ends its line is a directive; an inline one (`<!-- @ts-ignore --><input ...>`) does nothing.
