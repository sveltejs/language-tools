<script lang="ts">
    import Counter from './Counter.svelte';
    let count = 5;
</script>

<!-- component branch: value-less, expression value, and bare-namespace match -->
<Counter mochi:hydrate />
<Counter mochi:defer={count} />
<Counter mochi />

<!-- element branch: value-less, expression value, and bare-namespace match -->
<div mochi:foo>x</div>
<div mochi:bar={count}></div>
<div mochi></div>
