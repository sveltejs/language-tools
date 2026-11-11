<script generics="T">
    /** @type {{ value: T, onchange?: (value: T) => void }} */
    let { value, onchange } = $props();
</script>

<button onclick={() => onchange?.(value)}>change</button>
