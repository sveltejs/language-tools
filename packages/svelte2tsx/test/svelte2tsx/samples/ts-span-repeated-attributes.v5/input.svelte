<script lang="ts">
    let n = 1;
</script>

<button on:click={() => n++} on:click={(e) => e.button} class="a" title="x">+</button>
<svelte:window on:keydown={(e) => e.key} on:keydown={(e) => e.code} />
<p on:click on:click></p>
