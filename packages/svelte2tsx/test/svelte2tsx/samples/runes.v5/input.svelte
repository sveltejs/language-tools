<script>
    /** @type {{a: number, b: string}} */
    let { a, b } = $props();
    let x = $state(0);
    let y = $derived(x * 2);
</script>
