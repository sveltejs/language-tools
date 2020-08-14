<script>
  $: ({ count } = $data);
  $: ({ count2 } = $data)
  let count3;
  $: ({ count3 } = $data)
  let bla4;
  $: ({ bla4, bla5 } = $data)

  $: ([ count ] = $data);
  $: ([ count2 ] = $data)
  let count3;
  $: ([ count3 ] = $data)
  let bla4;
  $: ([ bla4, bla5 ] = $data)
</script>