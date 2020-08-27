<script>
    let b = 7;
    let d = 5;
    let e = 5;
</script>
<div>
    <slot a={b}>Hello</slot>
    <slot name="test" c={d} {e}></slot>
    <slot name="abc-cde.113"></slot>
</div>
