<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    interface Item {
        name: string;
    }

    export let item: Item;
    export let optional = 1;
    export const constant = 'c';

    const dispatch = createEventDispatcher<{ select: Item }>();
</script>

<button on:click={() => dispatch('select', item)}>{item.name} {optional}</button>
<slot name="footer" {item} />
