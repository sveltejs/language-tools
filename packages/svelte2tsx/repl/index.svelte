<script module lang="ts">
    let foo = true;
</script>

{#snippet hoistable1()}
    <div>hello</div>
{/snippet}

{#snippet hoistable2()}
    <div>{foo}</div>
{/snippet}
