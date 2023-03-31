{#if true}
<svelte:self prop1={1} />
{/if}
<svelte:component this={testComponent} propa={5}>
    <h1>content</h1>
</svelte:component>
<svelte:window on:click={e => {}}  />
<svelte:body on:click={e => {}} />
<svelte:head>
    <h1>Hi</h1>
</svelte:head>
<svelte:options />
<svelte:fragment />
<svelte:document foo="bar" on:click={e => {}} />
