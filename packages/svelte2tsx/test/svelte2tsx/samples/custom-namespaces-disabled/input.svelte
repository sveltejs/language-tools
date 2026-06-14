<script lang="ts">
    import Counter from './Counter.svelte';
    let count = 5;
</script>

<!-- Without customNamespaces configured, these emit as normal props/attributes,
     so downstream TypeScript reports them as invalid (the error this feature fixes). -->
<Counter mochi:hydrate />
<Counter mochi:defer={count} />
<Counter mochi />

<div mochi:foo>x</div>
<div mochi:bar={count}></div>
<div mochi></div>
