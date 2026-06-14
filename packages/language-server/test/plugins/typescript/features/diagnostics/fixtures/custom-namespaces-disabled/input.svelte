<script lang="ts">
    import Counter from './Counter.svelte';
</script>

<!-- No `customNamespaces` configured, so the namespaced attribute is validated as a prop
     and must error (the behavior this feature opts out of). -->
<Counter mochi:hydrate />
