<script lang="ts" generics="T extends { id: string }">
    interface Props {
        items: T[];
        onselect?: (item: T) => void;
    }

    let { items, onselect }: Props = $props();

    export function first(): T | undefined {
        return items[0];
    }
</script>

{#each items as item (item.id)}
    <button onclick={() => onselect?.(item)}>{item.id}</button>
{/each}
