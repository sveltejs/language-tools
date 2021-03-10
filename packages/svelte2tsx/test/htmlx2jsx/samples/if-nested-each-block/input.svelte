{#if hello}
    {#each items as item,i (item.id)}
        <div>{item}{i}</div>
    {/each}
    {#if hi && bye}
        {#each items as item}
            <div>{item}</div>
        {:else}
            <p>hi</p>
        {/each}
    {:else if cool}
        {#each items as item,i}
            <div>{item}{i}</div>
        {/each}
    {:else}
        {#each items as item}
            <div>{item}</div>
        {/each}
    {/if}
{/if}
