<script>
  import { writable } from 'svelte/store';
  const count = writable(0);
  const handler1 = () => !$count
</script>

<button on:click={() => !$count}>add</button>