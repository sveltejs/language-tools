<script lang="ts" context="module">
    export const foo = 'foo';
</script>

<script lang="ts">
  import Bar from './bar';
  import { createEventDispatcher } from 'svelte';

  export let bar: Bar;
  export let foobar = '';

  const dispatch = createEventDispatcher<{swipe: string}>();
</script>

<button on:click>hi</button>
<slot {bar}></slot>