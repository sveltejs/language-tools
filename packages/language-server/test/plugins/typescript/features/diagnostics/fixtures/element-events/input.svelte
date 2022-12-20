<script lang="ts">
</script>

<!-- valid -->
<div on:click={() => ''} />
<div on:click={() => ''} on:click={() => ''} />
<svelte:window on:click={() => ''} on:click={() => ''} />
<svelte:body on:click={() => ''} on:click={() => ''} />

<!-- invalid -->
<div on:wat={() => ''} />
<div on:click={e => e.asd} />
