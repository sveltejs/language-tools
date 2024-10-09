<svelte:options runes />

<script>
    let name1 = "world"
    let name2

    let rename1 = '';
    let rename2;

    class Foo {}
    function bar() {}
    const baz = '';

    class RenameFoo {}
    function renamebar() {}
    const renamebaz = '';

    export { name1, name2, rename1 as renamed1, rename2 as renamed2, Foo, bar, baz, RenameFoo as RenamedFoo, renamebar as renamedbar, renamebaz as renamedbaz };
</script>
