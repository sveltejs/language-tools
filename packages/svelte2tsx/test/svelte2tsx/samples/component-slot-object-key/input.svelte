{#each items as item}
    <slot a={item} b={{ item }} c={{ item: 'abc' }.item} d={{ item: item }}>Hello</slot>
{/each}
