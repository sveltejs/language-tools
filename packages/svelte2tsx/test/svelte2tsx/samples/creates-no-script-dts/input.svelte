<button on:click><slot /></button>
{#await Promise.resolve(0) then n}
  {n}
{/await}