<script lang="ts">
    let { a, b = $bindable(), c = $bindable(0) as number } = $props();
</script>
