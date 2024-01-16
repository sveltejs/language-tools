<script lang="ts">
    let { a, b } = $props<{ a: number, b: string }>();
    let x = $state(0);
    let y = $derived(x * 2);
</script>

<slot {x} {y} />
