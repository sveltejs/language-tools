{#if hello}
    {#await hello.foo then y}
        {y}
    {/await}
    {#await x then y}
        {y}
    {/await}
    {#await aPromise}
      {hello}
    {/await}
    {#if hi && bye}
        {#await x then y}
            {y}
        {:catch}
            z
        {/await}
    {:else if cool}
        {#await x}
            loading
        {:then y}
            {y}
        {:catch}
            z
        {/await}
    {:else}
        {#await x then y}
            {y}
        {/await}
    {/if}
{/if}
