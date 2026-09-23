<script>
    import Foo from './Foo.svelte';
    let x = true;
</script>

<Foo mochi:hydrate={x} mochi:defer prop="a" />
<div mochi:hydrate={x}></div>
