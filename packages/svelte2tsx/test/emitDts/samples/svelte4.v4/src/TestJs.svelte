<script>
    import { createEventDispatcher } from 'svelte';

    /** @type {string} */
    export let name;
    /** @type {number} */
    export let count = 0;
    /**
     * @type {string}
     */
    export const version = '1.0.0';

    const dispatch = createEventDispatcher();
    $: dispatch('change', count);
</script>

<slot label={name} {count} />
