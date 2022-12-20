<script lang="ts">
    import { createEventDispatcher } from "svelte";

    let a = [''];
    const dispatch = createEventDispatcher<{
        foo: string
    }>();
</script>

{#each a as item}
    <svelte:self on:foo></svelte:self>
{/each}