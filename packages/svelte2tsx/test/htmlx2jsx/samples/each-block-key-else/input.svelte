{#each items as item,i (item.id)}
    <div>{item}{i}</div>
{:else}
    <div>No Items</div>
{/each}