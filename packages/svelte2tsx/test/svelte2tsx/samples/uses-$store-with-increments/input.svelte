<script>
  import { writable } from 'svelte/store';
  const count = writable(0);
  const handler1 = () => ++$count
  const handler2 = () => $count--
</script>

<button on:click={() => ++$count}>add</button>
<button on:click={() => $count--}>subtract</button>
<button on:click={() => $count++}>add</button>
