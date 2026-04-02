<script
    generics="T extends Record<string, unknown> & { id: string }"
    lang="ts"
>
    import type { Readable } from 'svelte/store';

    export let store: Readable<T[]>;
</script>

{#if store}
    <p>ok</p>
{/if}
