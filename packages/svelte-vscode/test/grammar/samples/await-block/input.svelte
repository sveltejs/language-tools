{#await Promise.resolve('') then v}
    {v}
{/await}

{#await Promise.resolve('')}
{:then}
    {v}
{/await}

{#await Promise.reject('')}
{:catch err}
    {err}
{/await}

{#await Promise.reject('') catch name}...{/await}
