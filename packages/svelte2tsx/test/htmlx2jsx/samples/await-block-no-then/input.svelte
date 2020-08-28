{#await aPromise}
    <div>Spinner...</div>
{/await}

{#await aPromise}
  <div>Spinner...</div>
{:catch error}
  <div>Ups: {error}</div>
{/await}