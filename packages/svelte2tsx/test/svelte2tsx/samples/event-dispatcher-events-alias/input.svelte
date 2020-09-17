<script>
    import { createEventDispatcher as foo, abc } from "svelte";

    const notDispatch = abc();
    const dispatch = foo();

    dispatch('hi', true);

    function bye() {
        const bla = 'bye';
        dispatch(bla, false);
    }
</script>

<button on:click={() => dispatch('btn', '')}></button>