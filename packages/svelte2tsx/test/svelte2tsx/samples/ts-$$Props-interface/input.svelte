<script lang="ts">

    type $$Props = {
        exported1: string;
        exported2?: string;
        name1?: string;
        name2: string;
        renamed1?: string;
        renamed2: string;
    }

    export let exported1: string;
    export let exported2: string = '';

    let name1: string = "world"
    let name2: string;

    let rename1: string = '';
    let rename2: string;

    class Foo {}
    function bar() {}
    const baz: string = '';

    class RenameFoo {}
    function renamebar() {}
    const renamebaz: string = '';

    export { name1, name2, rename1 as renamed1, rename2 as renamed2, Foo, bar, baz, RenameFoo as RenamedFoo, renamebar as renamedbar, renamebaz as renamedbaz };
</script>
