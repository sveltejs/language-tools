<script lang="ts">
    let { value = $bindable() }: { value: string } = $props();
</script>

{value}
