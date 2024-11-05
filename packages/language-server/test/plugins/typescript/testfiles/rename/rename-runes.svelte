<script lang="ts">
    let { foo, bar = $bindable() }: { foo?: string; bar?: string; } = $props();
</script>

{foo}
{bar}