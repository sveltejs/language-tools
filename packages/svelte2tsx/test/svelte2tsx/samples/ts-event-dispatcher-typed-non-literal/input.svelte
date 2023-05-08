<script lang="ts">
    import { createEventDispatcher } from "svelte";

    type Events = {
        hi: boolean;
        bye: boolean;
        btn: string;
    };

    const dispatch = createEventDispatcher<Events>();

    dispatch('hi', true);

    function bye() {
        const bla = 'bye';
        dispatch(bla, false);
    }
</script>

<button on:click={() => dispatch('btn', '')}></button>