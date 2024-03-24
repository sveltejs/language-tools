<script>
    /** @typedef {{ a: string; b?: number }} Foo */

    /** @type {Foo} */
    let { a, b = 1 } = $props.bindable();
</script>
