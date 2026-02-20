<script>
    let x = $state();
</script>

<div
    // comment
    foo="bar"
    x // comment same line
    /* another comment */
    baz="qux"
    // event handler comment
    on:click={handler}
    // action comment
    use:action={params}
    // transition comment
    transition:fade
    // animation comment
    animate:flip
    // attachment comment
    {@attach attachment}
    // binding comment
    bind:this={element}
    // spread comment
    {...spread_props}
    trailing // trailing comment same line
></div>

<Component
    // comment
    foo="bar"
    /* another comment */
    baz="qux"
    // event handler comment
    on:click={handler}
    // attachment comment
    {@attach attachment}
    // binding comment
    bind:prop={bound_prop}
    // spread comment
    {...spread_props}
    // let comment
    let:item
    trailing
    // trailing comment newline
></Component>
