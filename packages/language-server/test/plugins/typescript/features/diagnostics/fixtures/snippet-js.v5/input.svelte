<script>
    // @ts-check
    /**
     * @typedef {'a' | 'b'} TypeA
    */
</script>

<!--no error-->
{#snippet hi(/**@type {TypeA}*/a, b = 2)}
    {a}
    {#if b === 'a'}
        {b}
    {/if}
{/snippet}

<!--error-->
{@render hi('c', 'd')}