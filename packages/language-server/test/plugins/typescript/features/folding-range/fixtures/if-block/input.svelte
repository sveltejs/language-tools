{#if name1 == "world"}
    <h1>Hello {name2}</h1>
{:else if name3 == "person"}
    <h2>hello {name4}</h2>
{:else}
    <h3>hey {name5}</h3>
{/if}

{#if kenobi}
    <h2>Hello There</h2>
{/if}

{#if name1 = 'hi'}
    <h2>hi</h2>
{:else}
    <h3>hello</h3>
{/if}