<Component>
    <svelte:fragment>
        <p>hi</p>
    </svelte:fragment>

    <svelte:fragment slot="named">
        <p>hi</p>
    </svelte:fragment>
</Component>

<Component>
    <svelte:fragment let:foo let:bar={baz}>
        <p>{foo} {baz}</p>
    </svelte:fragment>

    <svelte:fragment slot="named" let:foo let:bar={baz}>
        <p>{foo} {baz}</p>
    </svelte:fragment>
</Component>
