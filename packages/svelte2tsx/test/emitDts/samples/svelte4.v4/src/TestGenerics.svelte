<script lang="ts" generics="T extends { id: string }">
    import { createEventDispatcher } from 'svelte';

    export let items: T[];
    export let selected: T | undefined = undefined;

    const dispatch = createEventDispatcher<{ select: T }>();
</script>

{#each items as item (item.id)}
    <button on:click={() => dispatch('select', item)}>
        <slot {item} isSelected={item === selected} />
    </button>
{/each}
