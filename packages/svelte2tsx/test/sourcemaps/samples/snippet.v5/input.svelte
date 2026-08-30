{#snippet foo(x)}
	<div>asd{x}</div>
{/snippet}

{#snippet bar()}
	<div>asd</div>
{/snippet}

{#snippet await_inside()}
	{#await foo then bar}{bar}{/await}
{/snippet}

{#snippet defaultValue(x = '')}
	<div>asd{x}</div>
{/snippet}

{@render foo(1)}
{@render bar()}
{@render await_inside()}

<Component>
	<div>{asd}</div>
	{#snippet bar(x)}
		<div>asd{x}</div>
	{/snippet}
</Component>