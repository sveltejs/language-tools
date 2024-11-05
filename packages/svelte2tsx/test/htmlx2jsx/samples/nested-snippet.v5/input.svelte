{#if true}
    {@render foo()}
    {#snippet foo()}{/snippet}
{/if}

{#each arr as item}
    {@render foo()}
    {#snippet foo()}{/snippet}
{/each}

{#key key}
    {@render foo()}
    {#snippet foo()}{/snippet}
{/key}

{#snippet snippetBlock()}
    {@render foo()}
    {#snippet foo()}{/snippet}
    {#snippet foo2()}{/snippet}
{/snippet}

{#await Promise.resolve() then bar}
    {@render foo()}
    {#snippet foo()}{/snippet}
{/await}


<div>
    {@render foo()}
    {#snippet foo()}{/snippet}
</div>

<Component>
    {@render foo()}
    {#snippet foo()}{/snippet}
</Component>