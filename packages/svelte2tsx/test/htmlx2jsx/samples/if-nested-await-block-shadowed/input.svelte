{#if hello}
    {#await hello then hello}
        {hello}
        {#if hello}
            {#await x then hello}
                {#if hello}
                    {hello}
                {/if}
            {/await}
        {/if}
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

{#await cool}
    {#if cool}
        {cool}
    {:else if hello}
        {hello}
    {/if}
{:then cool}
    {#if cool}
        {cool}
    {:else if hello}
        {hello}
    {/if}
{:catch cool}
    {#if cool}
        {cool}
    {:else if hello}
        {hello}
    {/if}
{/await}