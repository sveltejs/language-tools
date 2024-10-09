<svelte:options runes />
<script>
    let name1: string = "world"
    let name2: string;
    let name3: string = '', name4: string;

    let rename1: string = '';
    let rename2: string;

    class Foo {}
    function bar() {}
    const baz: string = '';

    class RenameFoo {}
    function renamebar() {}
    const renamebaz: string = '';

    export { name1, name2, name3, name4, rename1 as renamed1, rename2 as renamed2, Foo, bar, baz, RenameFoo as RenamedFoo, renamebar as renamedbar, renamebaz as renamedbaz };
</script>
