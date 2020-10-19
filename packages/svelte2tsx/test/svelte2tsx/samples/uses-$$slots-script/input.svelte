<script>
    let name = $$slots.foo;
    let dashedName = $$slots['dashed-name'];
</script>

<h1>{name}</h1>
<slot name="foo" />
<slot name="dashed-name" />
<slot />