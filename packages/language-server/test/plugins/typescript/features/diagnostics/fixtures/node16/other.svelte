<script lang="ts">
  // valid
  import { foo } from './bar.js';
  // invalid
  import { baz } from './bar';

  foo;baz;
</script>
