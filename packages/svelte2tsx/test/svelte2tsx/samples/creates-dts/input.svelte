<script context="module">
    export const foo = 'foo';
</script>

<script>
  import { createEventDispatcher } from 'svelte';

  /** @type {boolean} */
  export let bar;
  export let foobar = '';

  const dispatch = createEventDispatcher();
  dispatch('hi');
</script>

<button on:click>hi</button>
<slot {bar}></slot>