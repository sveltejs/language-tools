<script>
    const items = [];
</script>

{#each items as item}
    <slot a={item}>Hello</slot>
{/each}
