{#if name == "world"}
    {@const hello = name}
    <h1>Hello {hello}</h1>
{:else if true}
    {@const hello = name}
    <h1>Hello {hello}</h1>
{:else}
    {@const hello = name}
    <h1>Hello {hello}</h1>
{/if}
