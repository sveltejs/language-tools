<script lang="ts">
  import Generics from './generics.svelte';
</script>

<!-- valid -->
<Generics a={['a', 'b']} b={'anchor'} c={false} on:b={(e) => e.detail === 'str'} let:a let:b>
  {a === 'str'}{b === 'anchor'}
</Generics>

<!-- invalid -->
<Generics a={[{a:1, b:1}]} b={'asd'} c={''} on:b={(e) => e.detail === true} let:a>
  {a === true}
</Generics>

<Generics a={['a', 'b']} b={'anchor'} c={false} let:b>
    {b === 'big'}
</Generics>
