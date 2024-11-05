<script lang="ts">
    import Component from './Component.svelte';

    let checked = false;
    let value: 'foo' | 'bar' = 'foo';
</script>

<input type="checkbox" bind:checked>

{#if checked === true}
    checked
{/if}

{#if value === 'bar'}
    bar
{/if}

<Component bind:value></Component>