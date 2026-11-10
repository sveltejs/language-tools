<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let name: string;
    export let count = 0;
    export const version = '1.0.0';
    export function reset() {
        count = 0;
    }

    const dispatch = createEventDispatcher<{ change: number }>();
    $: dispatch('change', count);
</script>

<button on:click>{name}: {count}</button>
<slot {count} />
<slot name="footer" label={name} />
