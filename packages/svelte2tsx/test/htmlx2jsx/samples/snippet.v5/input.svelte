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

<List data={[1, 2, 3]}>
	{#snippet row1(item)}
		{item}
	{/snippet}
	<p>html between snippets</p>
	{#snippet row2(item)}
		{item}
	{/snippet}
</List>

{@render children()}

{#snippet jsDoc(/**@type {number}*/a)}
	{a}
{/snippet}
