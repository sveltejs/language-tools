{#if hello}
    {#each items as hello,i (hello.id)}
        <div>{hello}{i}</div>
        {#if hello}
            {#each items as hello}
                {#if hello}
                    {hello}
                {/if}
            {/each}
        {/if}
    {:else}
        {#if hello}
            {hello}
        {/if}
    {/each}
    {#if hi && bye}
        {#each items as bye}
            <div>{bye}</div>
        {:else}
            {#if bye}
                {bye}
            {/if}
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

{#each items as hello,i}
    {#if hello && i && bye}
        {hello} {i} {bye}
    {:else if hello && i && bye}
        {hello} {i} {bye}
    {:else}
        {hello} {i} {bye}
    {/if}
{:else}
    {#if hello && i && bye}
        {hello} {i} {bye}
    {:else if hello && i && bye}
        {hello} {i} {bye}
    {:else}
        {hello} {i} {bye}
    {/if}
{/each}