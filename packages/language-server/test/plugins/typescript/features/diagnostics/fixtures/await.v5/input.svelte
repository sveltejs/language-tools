<script lang="ts">
    import Generic from "./generic.svelte";

    let a = Promise.resolve([1]);
    let b = Promise.resolve(2);
    let c = Promise.resolve('')
</script>

<!-- valid -->
<Generic a={await a} b={await b} />

{#each await a as item}
    {item === 1}
{/each}

<!-- invalid -->
<Generic a={await a} b={await c} />

{#each await a as item}
    {item === 'a'}
{/each}
