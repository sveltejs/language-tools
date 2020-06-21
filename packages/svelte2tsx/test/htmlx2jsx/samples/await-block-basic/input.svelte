{#await somePromise then value}
    <h1>Promise Resolved</h1>
{/await}

{#await somePromise}
    <h1>Loading...</h1>
{:then}
    <h1>Promise Resolved</h1>
{/await}
