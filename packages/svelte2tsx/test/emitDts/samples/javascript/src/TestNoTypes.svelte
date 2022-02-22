<script>
    import { createEventDispatcher } from 'svelte';
    export let noType;
    export let initializer = 'foo';
    const dispatch = createEventDispatcher();
    dispatch('event', true);
</script>

<slot {noType} />
