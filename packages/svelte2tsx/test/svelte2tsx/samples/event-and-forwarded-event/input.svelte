<script>
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
    dispatch("mount", { input });
</script>

<input on:focus />