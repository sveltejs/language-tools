<script>
    let callback = (id) => undefined;
    class B {
        constructor(id) { }

        method(id) { }

        set id(id) { }
    }

    $: ({ id } = { id: '' });
</script>
