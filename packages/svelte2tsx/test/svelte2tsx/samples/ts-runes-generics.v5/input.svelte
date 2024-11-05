<script lang="ts" generics="T">
    let { a, b }: { a: T, b: string } = $props();
    let x = $state<T>(0);
    let y = $derived(x * 2);
</script>
