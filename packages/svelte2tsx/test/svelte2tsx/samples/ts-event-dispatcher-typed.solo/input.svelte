<script>
    import { createEventDispatcher, abc } from "svelte";

    const notDispatch = abc();
    const bla = 'bye';
    const dispatch = createEventDispatcher<{hi: boolean; [bla]: boolean; btn: string;}>();

    dispatch('hi', true);

    function bye() {
        dispatch(bla, false);
    }
</script>

<button on:click={() => dispatch('btn', '')}></button>