{#if hello}
    {#await x then hello}
        {hello}
        {#await x then hello}
            {#if hello}
                {hello}
            {/if}
        {/await}
    {/await}
    {#if hi && bye}
        {#await x then bye}
            {bye}
        {:catch hello}
            {#if hello}
                {hello}
            {/if}
        {/await}
    {:else if cool}
        {#await cool}
            loading
        {:then cool}
            {#if cool}
                {cool}
            {/if}
        {:catch cool}
            z
        {/await}
    {:else}
        {#await x then hello}
            {#if hello}
                {hello}
            {/if}
        {/await}
    {/if}
{/if}
