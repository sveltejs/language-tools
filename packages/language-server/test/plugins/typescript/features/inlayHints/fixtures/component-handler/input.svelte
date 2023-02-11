<script lang="ts">
    import { SvelteComponentTyped } from 'svelte';

    let Component: typeof SvelteComponentTyped<{}, { click: MouseEvent }, {}>;
</script>

<Component on:click></Component>
<Component on:click={e => console.log(e)}></Component>