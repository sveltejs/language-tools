<script lang="ts">
    import Child from './Child.svelte';

    const constant = 'a';
    const readonlyObject = { get value() { return 'a'; } };
</script>

<!-- svelte2tsx copies binding expressions into generated code, which TS6 ignores -->
<input bind:value={doesNotExist} />
<input bind:value={constant} />
<input bind:value={readonlyObject.value} />
<Child bind:value={alsoDoesNotExist} />
