<script lang="ts">
    const value = true;
    const items = [1, 2, 3];
</script>

{items.map((item) => item)}

{#each items as item}
    {@const getter = () => item}
    {getter()}
{/each}

<Component>
    {#snippet children()}
        <Child {value} />
    {/snippet}
</Component>

<Component>
    {#snippet children({ data })}
        <Child {data} />
    {/snippet}
</Component>
