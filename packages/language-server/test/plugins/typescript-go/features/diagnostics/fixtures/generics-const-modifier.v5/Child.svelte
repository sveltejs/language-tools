<script lang="ts" generics="const T extends readonly string[]">
    let { items, onselect }: { items: T; onselect?: (item: T[number]) => void } = $props();
</script>

{#each items as item}
    <button onclick={() => onselect?.(item)}>{item}</button>
{/each}
