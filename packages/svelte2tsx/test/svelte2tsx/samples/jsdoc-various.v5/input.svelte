<script generics="T">
  /** @type {{ b: T }}*/
  let { b } = $props();
  let rect;
</script>

{#snippet foo(bar)}
  {bar}
{/snippet}

<div bind:contentRect={rect}></div>
<slot></slot>
