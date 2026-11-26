<script lang="ts">
    import Child from './Child.svelte';
</script>

<!-- `const T`: the items are inferred as the tuple ['a', 'b'], not string[] -->
<Child items={['a', 'b']} onselect={(item) => { const narrowed: 'a' | 'b' = item; narrowed; }} />
<Child items={['a', 'b']} onselect={(item) => { const wrong: 'c' = item; wrong; }} />
