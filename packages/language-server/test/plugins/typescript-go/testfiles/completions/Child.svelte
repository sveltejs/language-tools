<script lang="ts">
    let { value, verbose = false }: { value: string; verbose?: boolean } = $props();
</script>

{value}{verbose}
