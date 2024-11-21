<script module>
    let module = true;
</script>

<script lang="ts">
    import { imported } from './x';
    let foo = true;
</script>

{#snippet hoistable1()}
    <div>hello</div>
{/snippet}

{#snippet hoistable2(bar)}
    <div>{bar}</div>
{/snippet}

{#snippet hoistable3(bar: string)}
    <div>{bar}</div>
{/snippet}

{#snippet hoistable4(foo)}
    <div>{foo}</div>
{/snippet}

{#snippet hoistable5()}
    <button onclick={e => e}>click</button>
{/snippet}

{#snippet hoistable6()}
    <div>{module}</div>
{/snippet}

{#snippet hoistable7()}
    <div>{imported}</div>
{/snippet}

{#snippet not_hoistable()}
    <div>{foo}</div>
{/snippet}
