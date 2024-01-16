{#await somePromise then value}
    <h1>Promise Pending</h1>
{/await}

{#await somePromise 
    
    then value}
    <h1>Promise Pending</h1>
{/await}