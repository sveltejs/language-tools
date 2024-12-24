{#each items as item}
    <div>{item}</div>
{:else}
    <div></div>
{/each}

{#each showGroups as [key, items] (key)}

{/each}

{#each v}
    this should be seen as text 
{/each}

{#each v }
    this should be seen as text 
{/each}

{#each v, i}
    this should be seen as text 
{/each}

{#each v , i}
    this should be seen as text 
{/each}
