<script lang="ts">
    import {writable} from 'svelte/store'
    const store = writable<{ val: number } | null>(null);
</script>

{#if $store}<p>{$store.val}</p>{/if}
{#if $store !== null}<p>{$store.val}</p>{/if}
