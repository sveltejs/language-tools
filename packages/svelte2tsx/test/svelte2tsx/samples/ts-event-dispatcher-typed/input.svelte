<script>
    import { createEventDispatcher, abc } from "svelte";

    const notDispatch = abc();
    const bla = 'bye';
    const dispatch = createEventDispatcher<{
    /**
     * A DOC
     */
    hi: boolean; 
    /**
     * not this
     */
    /**
     * ANOTHER DOC
     */
    [bla]: boolean;
    // not this
    btn: string;}>();

    dispatch('hi', true);

    function bye() {
        dispatch(bla, false);
    }
</script>

<button on:click={() => dispatch('btn', '')}></button>