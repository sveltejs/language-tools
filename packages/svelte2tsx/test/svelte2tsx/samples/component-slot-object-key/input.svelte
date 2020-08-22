{#each items as item}
    <slot a={item} b={{ item }} c={{ item: 'abc' }.item}>Hello</slot>
{/each}
