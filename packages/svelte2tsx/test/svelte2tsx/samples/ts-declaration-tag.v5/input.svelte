<script lang="ts">
    type Box = { width: number; height: number };

    let boxes: Box[] = [
        { width: 3, height: 4 },
        { width: 5, height: 7 }
    ];
</script>

{#each boxes as box}
    {const area = box.width * box.height}
    {let label = $state(`${area} square pixels`)}
    {const doubled = area * 2}

    <p>{doubled} {label}</p>
    <div>
        {const area = 'nested'}
        {area}
    </div>
{/each}
