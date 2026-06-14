<script lang="ts">
    import Counter from './Counter.svelte';
</script>

<!-- The namespace is exempt from prop validation, but the value expression is still
     type-checked: `typoVar` is undefined, so this must still error. -->
<Counter mochi:defer={typoVar} />
