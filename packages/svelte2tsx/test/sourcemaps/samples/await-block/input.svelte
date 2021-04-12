{#await promise then value}
    <element foo={value.bar}/>
{/await}

{#await promise}
	<element />
{:then}
	<element />
{/await}

{#await $promise}
	<element />
{/await}
