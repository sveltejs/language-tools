<script lang="ts">
    import { SvelteComponentTyped } from 'svelte';

    let Component: typeof SvelteComponentTyped;
    function hi(name: string) {}
</script>

<Component text={hi('')}></Component>