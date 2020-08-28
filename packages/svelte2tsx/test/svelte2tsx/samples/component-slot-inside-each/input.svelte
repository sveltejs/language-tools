{#each items as item}
    <slot a={item}>Hello</slot>
{/each}
{#each items2 as { a }}
    <slot name="second" {a}>Hello</slot>
{/each}
