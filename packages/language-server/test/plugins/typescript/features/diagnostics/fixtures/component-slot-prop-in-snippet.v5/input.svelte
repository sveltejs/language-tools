<script>
    import Button from './Button.svelte';
    import ButtonBadge from './ButtonBadge.svelte';
</script>

<Button>
    {#snippet badge()}
        <ButtonBadge slot="badge"></ButtonBadge>
    {/snippet}
</Button>
