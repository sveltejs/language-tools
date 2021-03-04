<script lang="ts">
</script>

{#if typeof a === 'string'}
    {a === true}
    {#each [true] as a}
        {a === true}
    {/each}
    {#if b}
        {b}
    {/if}
{/if}
