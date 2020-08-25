{#await promise then value}
    <slot a={value}>Hello</slot>
{:catch err}
    <slot name="err" err={err}>Hello</slot>
{/await}
{#await promise2 then { b }}
    <slot name="second" a={b}>Hello</slot>
{/await}
