<script lang="ts">
    import { SvelteComponentTyped } from "svelte";
    import Imported from './imported.svelte';

    class Works extends SvelteComponentTyped<any, any, any> {}
    class Works2 extends SvelteComponentTyped<
        { hi: string },
        { click: MouseEvent },
        {
            default: {
                foo: string;
            };
        }
    > {}
    class DoesntWork {}
</script>

<!-- valid -->
<Works />
<Imported />
<Works2 hi="hi" on:click={e => console.log(e.movementX)} let:foo>
    {foo.toLocaleLowerCase()}
</Works2>

<!-- invalid -->
<DoesntWork />
