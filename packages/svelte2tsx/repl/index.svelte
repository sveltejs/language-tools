<script>
    export let value;
</script>

{#if value}
    <input bind:value on:change />
{/if}
