<script lang="ts">
    let { value = $bindable(), readonly }: { value: string; readonly: string } = $props();
</script>

{value}{readonly}
