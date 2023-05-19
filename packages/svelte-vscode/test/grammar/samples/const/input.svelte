{#each items as item}
    {@const _item = item}
    {item}
    {@const { a } = abc}
    {@const [ e ] = abc}
{/each}
