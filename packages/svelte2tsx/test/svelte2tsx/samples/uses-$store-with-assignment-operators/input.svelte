<script>
  import { writable } from 'svelte/store';
  const count = writable(0);
  let myvar = 42 // to show that this is different from ++ or --
  const handler1 = () => $count += myvar
  const handler2 = () => $count -= myvar
  const handler3 = () => $count *= myvar
  const handler4 = () => $count /= myvar
  const handler5 = () => $count **= myvar
  const handler6 = () => $count %= myvar
  const handler7 = () => $count <<= myvar
  const handler8 = () => $count >>= myvar
  const handler9 = () => $count >>>= myvar
  const handler10 = () => $count &= myvar
  const handler11 = () => $count ^= myvar
  const handler12 = () => $count |= myvar
</script>

<button on:click={() => $count += myvar}>add</button>
<button on:click={() => $count -= myvar}>subtract</button>
<button on:click={() => $count *= myvar}>multiply</button>
<button on:click={() => $count /= myvar}>divide</button>
<button on:click={() => $count **= myvar}>exponent</button>
<button on:click={() => $count %= myvar}>mod</button>
<button on:click={() => $count <<= myvar}>leftshift</button>
<button on:click={() => $count >>= myvar}>rightshift</button>
<button on:click={() => $count >>>= myvar}>unsigned rightshift</button>
<button on:click={() => $count &= myvar}>AND</button>
<button on:click={() => $count ^= myvar}>XOR</button>
<button on:click={() => $count |= myvar}>OR</button>
