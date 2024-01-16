{#await somePromise}
    <h1>Promise Pending</h1>
{:then value}
    <h1>Promise Resolved {value}</h1>
{:catch error}
    <h1>Promise Errored {error}</h1>
{/await}

{#await somePromise}
    <h1>Promise Pending</h1>
{
    :then value}
    <h1>Promise Resolved {value}</h1>
{
    :catch error}
    <h1>Promise Errored {error}</h1>
{/await}
