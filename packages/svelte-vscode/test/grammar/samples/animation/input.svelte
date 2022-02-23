{#each list as item, index (item)}
	<li animate:flip>{item}</li>
{/each}

{#each list as item, index (item)}
	<li animate:flip={{ delay: 500 }}>{item}</li>
{/each}
