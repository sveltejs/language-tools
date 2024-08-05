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

{#snippet foo2(bar : string)}
    snippet
{/snippet}

{#snippet foo3(bar    : string | number)}
    snippet
{/snippet}

{#snippet foo4(bar    : string | number, baz     : (str: string)=>void)}
    snippet
{/snippet}

{#snippet foo5(bar: {baz: string})}
    snippet
{/snippet}

{#snippet foo6(bar?: string)}
    snippet
{/snippet}

{#snippet foo7(bar, baz = '')}
    snippet
{/snippet}

{@render foo(bar as string)}

<button onclick={(e: Event) => {e as any}}>click</button>
<Component attr={attr as boolean} />
<label id={ok!}></label>
<Component bind:this={x as any} />
<div bind:clientWidth={x as any} />
