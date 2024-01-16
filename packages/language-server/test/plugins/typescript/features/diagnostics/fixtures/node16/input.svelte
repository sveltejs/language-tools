<script lang="ts">
  // valid
  import { foo } from './bar.js';
  import Other from './other.svelte';
  // invalid
  import { baz } from './bar';

  foo;baz;Other;
</script>
