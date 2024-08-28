<script lang="ts">
    let { runes1 = $bindable(), runes2 = $bindable() }: { runes1: string, runes2: string | number } = $props();
</script>

{runes1}
{runes2}