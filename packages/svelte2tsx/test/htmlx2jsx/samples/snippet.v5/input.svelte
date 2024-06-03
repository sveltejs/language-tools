{#snippet foo(x)}
	<div>asd{x}</div>
{/snippet}

{#snippet bar()}
	<div>asd</div>
{/snippet}

{#snippet await_inside()}
	{#await foo then bar}{bar}{/await}
{/snippet}

{#snippet default_parameter(a = '')}
	{a}
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

<List data={[1, 2, 3]}>
	{#snippet row(item)}
		{item}
	{/snippet}
	{#snippet await_inside()}
		{#await foo then bar}{bar}{/await}
	{/snippet}
</List>

<List>
	implicit children
</List>

{@render children()}
