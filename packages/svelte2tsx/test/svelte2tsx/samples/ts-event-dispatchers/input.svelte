<script>
    import { createEventDispatcher, abc } from "svelte";

    const notDispatch = abc();
    const dispatch1 = createEventDispatcher<{
    /**
     * A DOC
     */
    hi: boolean;
    }>();
    const dispatch2 = createEventDispatcher<{btn: string;}>();
    const dispatch3 = createEventDispatcher();

    dispatch3('bye', true);
</script>

<button on:click></button>