{#if name == "world"}{#if bla}asd{/if}{#if bla}asd{/if}{:else if foo}{#if bla}asd{:else}bar{/if}{:else}{#if bla}asd{:else if blubb}asd{/if}{/if}

{#if name == "world"}
    {#if bla}asd{/if}
    {#if bla}
        asd
    {:else}
        bar
    {/if}
    {#if bla}
        asd
    {:else if blubb}
        bar
    {/if}
    {#if bla}
        asd
    {:else if blubb}
        bar
    {:else}
        foo
    {/if}
{:else if foo}
    {#if bla}asd{/if}
    {#if bla}
        asd
    {:else}
        bar
    {/if}
    {#if bla}
        asd
    {:else if blubb}
        bar
    {/if}
    {#if bla}
        asd
    {:else if blubb}
        bar
    {:else}
        foo
    {/if}
{:else}
    {#if bla}asd{/if}
    {#if bla}
        asd
    {:else}
        bar
    {/if}
    {#if bla}
        asd
    {:else if blubb}
        bar
    {/if}
    {#if bla}
        asd
    {:else if blubb}
        bar
    {:else}
        foo
    {/if}
{/if}