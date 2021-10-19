<script>
  import { writable } from 'svelte/store';
  const count = writable(0);
  const handler1 = () => !$count
  const handler2 = () => +$count
  const handler3 = () => -$count
  const handler4 = () => ~$count
</script>

<button on:click={() => !$count}>add</button>
<button on:click={() => +$count}>add</button>
<button on:click={() => -$count}>add</button>
<button on:click={() => ~$count}>add</button>