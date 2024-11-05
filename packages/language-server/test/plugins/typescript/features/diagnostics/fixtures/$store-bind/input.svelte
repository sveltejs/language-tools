<script lang="ts">
  import { writable } from 'svelte/store';
  import { Component } from './components'

  const storeNr = writable(1);
  const storeBool = writable(true);
  const storeObjNr = writable({foo: 1});
  const storeObjBool = writable({foo: true});
</script>

<!-- valid -->
<div bind:offsetHeight={$storeNr} />
<Component bind:prop={$storeNr} />
<div bind:offsetHeight={$storeObjNr.foo} />
<Component bind:prop={$storeObjNr.foo} />

<!-- error -->
<div bind:offsetHeight={$storeBool} />
<Component bind:prop={$storeBool} />
<div bind:offsetHeight={$storeObjBool.foo} />
<Component bind:prop={$storeObjBool.foo} />
