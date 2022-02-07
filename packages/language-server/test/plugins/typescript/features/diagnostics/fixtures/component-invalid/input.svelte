<script lang="ts">
    import { SvelteComponentTyped } from "svelte";
    import Imported from './imported.svelte';

    class Works extends SvelteComponentTyped<any, any, any> {}
    class DoesntWork {}
</script>

<!-- valid -->
<Works />
<Imported />

<!-- invalid -->
<DoesntWork />
