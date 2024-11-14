<script>
    /** @type {{ foo: string, bar?: number }} */
    let { foo, bar = $bindable() } = $props();

    export function baz() {}
</script>
