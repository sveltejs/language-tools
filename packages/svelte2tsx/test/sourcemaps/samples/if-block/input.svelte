{#if foo}
	<element />
{/if}

{#if $foo}<element />{/if}

{#if foo}
	<element/>
{:else if bar}
	<element/>
{:else}
	<element/>
{/if}