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

{#if typeof a === 'string'}
    {@const aStr = a}
    {@const aStr2 = aStr}

    {a}
{:else if typeof a === 'number'}
    {@const aNum = a}
{/if}

{#if typeof a === 'string'}
    {@const aStr = a}
{/if}

{#if typeof a === 'string'}
    {@const aStr = a}
{:else}
{/if}
