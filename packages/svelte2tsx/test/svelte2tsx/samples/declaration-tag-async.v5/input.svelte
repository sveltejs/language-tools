<script lang="ts">
    type Box = { width: number; height: number };

    let boxes: Box[] = [
        { width: 3, height: 4 },
        { width: 5, height: 7 }
    ];
</script>

{#each boxes as box}
    {const area = box.width * box.height}
    {let label = $state(await `${area} square pixels`)}

    <p>{label}</p>
    <div>
        {const area = await 'nested'}
        {area}
    </div>

    {#snippet foo()}
        {const area = await 'snippet'}
        {area}
    {/snippet}
{/each}
