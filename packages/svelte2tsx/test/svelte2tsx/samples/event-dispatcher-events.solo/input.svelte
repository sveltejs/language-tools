<script>
    import { createEventDispatcher, abc } from "svelte";

    const notDispatch = abc();
    const dispatch = createEventDispatcher();

    dispatch('hi', true);

    function bye() {
        const bla = 'bye';
        dispatch(bla, false);
    }
</script>

<button on:click={() => dispatch('btn', '')}></button>