<script lang="ts">
    import AccessorsAndOption from './accessors-and-option.svelte';
    import Accessors from './accessors.svelte';

    let a: Accessors;
    let ao: AccessorsAndOption;

    $: a.abc = ao.abc = '';
</script>

<Accessors bind:this={a} />
<AccessorsAndOption bind:this={ao} />
