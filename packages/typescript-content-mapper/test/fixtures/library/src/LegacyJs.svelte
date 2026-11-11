<script>
    import { createEventDispatcher } from 'svelte';

    /** @type {string} */
    export let label;
    export let disabled = false;

    const dispatch = createEventDispatcher();
</script>

<button {disabled} on:click={() => dispatch('press', label)}>{label}</button>
<slot {label} />
