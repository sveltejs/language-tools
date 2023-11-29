{#snippet foo(x)}
	<div>asd{x}</div>
{/snippet}

{#snippet bar()}
	<div>asd</div>
{/snippet}

{@render foo(1)}
{@render bar()}

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
</List>

<List>
	implicit children
</List>

{@render children()}
