{#each items as item}
    {#each item as { a }}
        <slot {a}>Hello</slot>
    {/each}
{/each}
