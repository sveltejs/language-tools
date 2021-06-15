<script strictEvents>
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();
    dispatch('foo');
</script>

<button on:click>d</button>