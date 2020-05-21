{#await somePromise}
    <h1>Promise Pending</h1>
{:then value}
    <h1>Promise Resolved {value}</h1>
{/await}