<script>
  $: ({bla} = blubb);
  $: ({bla2} = blubb)
  let bla3;
  $: ({ bla3 } = blubb)

  $: ({ count } = $data);
  $: ({ count2 } = $data)
  let count3;
  $: ({ count3 } = $data)
</script>