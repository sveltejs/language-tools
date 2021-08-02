<script lang="ts">
    import AccessorsAndOption from './acceesors/accessors-and-option.svelte';
    import Accessors from './acceesors/accessors.svelte';
    import CustomElement from './customElement/customElement.svelte';

    let c: CustomElement;
    let a: Accessors;
    let ao: AccessorsAndOption;

    $: c.abc = a.abc = ao.abc = '';
</script>

<CustomElement />
<Accessors />
<AccessorsAndOption />