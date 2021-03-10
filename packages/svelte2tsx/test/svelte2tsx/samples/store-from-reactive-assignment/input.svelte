<script>
    $: store = fromSomewhere();
    $: ({ store1, noStore } = fromSomewhere());
    $: [ store2, noStore ] = fromSomewhere();
</script>
<p>{$store}</p>
<p>{$store1}</p>
<p>{$store2}</p>
