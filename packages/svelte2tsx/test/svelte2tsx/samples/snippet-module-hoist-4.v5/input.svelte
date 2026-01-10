<script module lang="ts">

</script>

<script>
    let foo = true;
</script>

{#snippet chain()}
    <div>{foo}</div>
{/snippet}

{#snippet chain2()}
    {@render chain()}
{/snippet}

{#snippet chain3()}
    {@render chain2()}
{/snippet}

{#snippet hoistable()}
	<h1>hoist me</h1>
{/snippet}