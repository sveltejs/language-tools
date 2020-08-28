{#each items as item}
    {#each item as { a }}
        <slot {a}>Hello</slot>
    {/each}
    <slot name="second" { a }></slot>
{/each}
<Component let:c>{ c }</Component>
{#await promise then d}
    {d}
{/await}
<slot name="third" {d} {c}></slot>
