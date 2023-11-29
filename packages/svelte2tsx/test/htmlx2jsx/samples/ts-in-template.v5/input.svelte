<script lang="ts"></script>

{#if foo as true}
    if
{:else if bar as false}
    else if
{/if}

{#each items as [''] as item: string, i (item)}
    {item as string}
{/each}

{#await foo as Promise<void>}
    waiting
{:then result: any}
    result
{:catch error: any}
    error
{/await}

{#key item as string}
    key
{/key}

{#snippet foo(bar: string)}
    snippet
{/snippet}

{@render foo(bar as string)}

<button onclick={(e: Event) => {e as any}}>click</button>
<Component attr={attr as boolean} />
