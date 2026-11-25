<script lang="ts">
    import CustomElement from './customElement.svelte';

    let c: CustomElement;

    $: c.abc = '';
</script>

<CustomElement bind:this={c} />
