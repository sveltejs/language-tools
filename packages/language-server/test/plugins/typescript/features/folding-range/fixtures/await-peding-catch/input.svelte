{#await somePromise}
    <h1>Promise Pending</h1>
{:catch error}
    <h1>Promise Errored {error}</h1>
{/await}

{#await somePromise}
    <h1>Promise Pending</h1>
{
    :catch error}
    <h1>Promise Errored {error}</h1>
{/await}