<script lang="ts">
    import Counter from './Counter.svelte';

    let count = 5;
</script>

<Counter mochi:hydrate />
<Counter mochi:defer={count} />
<Counter mochi />

<div mochi:foo>x</div>
<div mochi:bar={count}></div>
<div mochi></div>
