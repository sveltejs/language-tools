<script lang="ts">
    import { SvelteComponentTyped } from 'svelte';

    let Component: typeof SvelteComponentTyped<{}, { click: MouseEvent }, {}>;

    function log(message: any) {}
</script>

<Component on:click></Component>
<Component on:click={e => log(e)}></Component>