<script lang="ts" generics="T">
    let { a, b } = $props<{ a: T, b: string }>();
    let x = $state<T>(0);
    let y = $derived(x * 2);
</script>

<slot {x} {y} />
