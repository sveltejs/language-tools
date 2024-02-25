<script>
    /** @type {SomeType} */
    let { a, b } = $props();
    let x = $state(0);
    let y = $derived(x * 2);
</script>

<slot {x} {y} />
