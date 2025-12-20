<script lang="ts">
    import { imported } from './x';
    let foo = true;
</script>

{#snippet hoistable()}
    <div>hello</div>
{/snippet}

{#snippet not_hoistable()}
    <div>{foo}</div>
{/snippet}
