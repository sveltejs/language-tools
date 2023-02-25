<script lang="ts">
    const hi = 1;

    hi = 1;
</script>

{#if hi == 1}
    {@const hi2 = hi}

    <button on:click={() => hi2 = 2}></button>
{/if}
