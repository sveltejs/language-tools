<script>
    import { flip } from 'svelte/animate'

    let items = [{ id: 1 }];
</script>

{#each items as item (item.id)}
    <div animate:flip></div>
{/each}