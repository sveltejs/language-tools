<script lang="ts">
    type Box = { width: number; height: number };

    let boxes: Box[] = [
        { width: 3, height: 4 },
        { width: 5, height: 7 }
    ];
</script>

{#each boxes as box}
    {const area = box.width * box.height}
    {let label: number = $state(`${area} square pixels`)}
    {var doubled: string = area * 2}
    {function format(value: string) {
        return value.toFixed(2);
    }}

    <p>{format(doubled)} {label === 'large'}</p>
{/each}
