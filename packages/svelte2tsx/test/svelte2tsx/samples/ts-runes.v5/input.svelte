<script lang="ts">
    let { a, b }: { a: number, b: string } = $props();
    let x = $state(0);
    let y = $derived(x * 2);
</script>
