<script>
    /** @typedef {{ a: string; b?: number }} Foo */

    /** @type {Foo} */
    let { b = 1 } = $props();

    /** @type {Foo} */
    let { a } = $props.bindable();
</script>
