<script>
  let tag = 'div';
</script>

<svelte:element this={tag} />
<svelte:element this="tag" />
<svelte:element this={tag ? 'a' : 'b'} />
<svelte:element this={tag}>{tag}</svelte:element>
<svelte:element this={tag} on:click={() => tag} />
<svelte:element this={'a'} sveltekit:prefetch href="https://kit.svelte.dev" />
