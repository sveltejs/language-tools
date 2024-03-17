<script>
    /** @type {{b?: number}} */
    let { b = 1 } = $props();

    /** @type {{a: string}} */
    let { a } = $props.bindable();
</script>
