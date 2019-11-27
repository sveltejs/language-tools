
# svelte2tsx

Converts [Svelte](https://svelte.dev) component source into TSX. The TSX can be type checked using the included `svelte-jsx.d.ts` and `svelte-shims.d.ts`.

_This project only converts svelte to tsx, type checking is left to consumers of this plugin such as language services_


```typescript
type SvelteCompiledToTsx = {
    code: string,
    map: import("magic-string").SourceMap
}

export default function svelte2tsx(svelte: string): SvelteCompiledToTsx
```

For example

Input.svelte
```svelte
<h1>hello {world}</h1>
<script>
    export let world = "name"
</script>
```

Will produce
```tsx
<></>;function render() {

     let name = "world"
;
<></>
return { props: {name}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
```

with a v3 SourceMap back to the original source. 

For more examples of the transformations, see the `test/**/samples` folders
