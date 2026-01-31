<script module>
    import { store2 } from './foo';
</script>

<script>
    import { store } from './foo';
</script>

{#snippet _foo()}
    {$store}
{/snippet}

{#snippet _foo2()}
    {$store2}
{/snippet}