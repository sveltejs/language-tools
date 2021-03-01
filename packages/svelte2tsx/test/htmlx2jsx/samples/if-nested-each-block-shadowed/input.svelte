{#if hello}
    {#each items as hello,i (hello.id)}
        <div>{hello}{i}</div>
    {/each}
    {#if hi && bye}
        {#each items as bye}
            <div>{bye}</div>
        {:else}
            <p>hi</p>
        {/each}
    {:else if cool}
        {#each items as item,cool}
            <div>{item}{cool}</div>
        {/each}
    {:else}
        {#each items as hello}
            <div>{hello}</div>
        {/each}
    {/if}
{/if}
