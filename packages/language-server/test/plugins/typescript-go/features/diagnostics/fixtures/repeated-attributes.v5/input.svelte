<script lang="ts">
    function handle(_e: MouseEvent) {}
</script>

<!-- fine -->
<button on:click={handle} on:click={(e) => e.button}>a</button>
<svelte:window on:keydown={(e) => e.key} on:keydown={(e) => e.code} />
<!-- errors in the repeated ones are still reported -->
<button on:click={handle} on:click={(e) => e.notThere}>b</button>
<div on:wat={() => ''} on:wat={() => ''}></div>
