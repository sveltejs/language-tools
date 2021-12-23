{#each items as item}
    <slot a={item} b={{ item }} c={{ item: 'abc' }.item} d={{ item: item }} e={$item} f="{$item}" {...g} {...item}>Hello</slot>
{/each}
