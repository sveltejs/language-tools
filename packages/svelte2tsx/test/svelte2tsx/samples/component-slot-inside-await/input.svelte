<script>
    const promise = Promise.resolve();
</script>

{#await promise then value}
    <slot a={value}>Hello</slot>
{/await}
