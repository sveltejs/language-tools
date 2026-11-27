<script module lang="ts">
    export { default as Reexported } from './MissingReexport.svelte';
</script>

<script lang="ts">
    import Child from './Child.svelte';
    import Missing from './Missing.svelte';
    import Lib from 'not-installed/Comp.svelte';
    // @ts-ignore
    import Ignored from './Ignored.svelte';
    // @ts-expect-error
    import Expected from './Expected.svelte';
    // @ts-expect-error
    import ExpectedButFound from './Child.svelte';
</script>

<Child /><Missing /><Lib /><Ignored /><Expected /><ExpectedButFound />
