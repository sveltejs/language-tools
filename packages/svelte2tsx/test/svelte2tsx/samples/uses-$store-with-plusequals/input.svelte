<script>
  import { writable } from 'svelte/store';
  const count = writable(0);
  let myvar = 4 + 8 + 15 + 16 + 23 + 42
  const handler1 = () => $count += myvar
  const handler2 = () => $count -= myvar
  const handler3 = () => $count *= myvar
  const handler4 = () => $count /= myvar
  const handler5 = () => $count **= myvar
  const handler6 = () => $count %= myvar
</script>

<button on:click={() => $count += myvar}>add</button>
<button on:click={() => $count -= myvar}>subtract</button>
<button on:click={() => $count *= myvar}>multiply</button>
<button on:click={() => $count /= myvar}>divide</button>
<button on:click={() => $count **= myvar}>exponent</button>
<button on:click={() => $count %= myvar}>mod</button>