<script>
    import { createEventDispatcher, abc } from "svelte";

    const notDispatch = abc();
    const dispatch1 = createEventDispatcher();
    const dispatch2 = createEventDispatcher();

    dispatch1('hi', true);
    dispatch2('bye', true);
</script>

<button on:click></button>