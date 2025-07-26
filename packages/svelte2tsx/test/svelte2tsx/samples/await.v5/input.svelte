<script>
    let { prop = true } = $props();
    const foo = await fetch('/foo');
    const promise = fetch('/bar');
</script>

{foo}
{await promise}

{#each await promise as item}
    {item}
{/each}

{#each await promise as item, i}
    {item} {i}
{/each}

{#each await promise as item, i (item.x)}
    {item} {i}
{/each}

{#each await promise}
    x
{/each}

{#if await promise}
    x
{:else if await promise}
    x
{/if}

{#snippet x()}
    {await promise}
{/snippet}

<Component prop={await promise} />
<p attribute={await promise}></p>

{@render x(await promise)}

{#if true}
    {@const x = await promise}
    {x}
{/if}
