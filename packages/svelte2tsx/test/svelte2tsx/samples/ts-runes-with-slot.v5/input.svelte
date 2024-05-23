<script lang="ts" generics="T">
    type Props = { a: T, b: string };
    let { a, b }: Props = $props();
    let x = $state<T>(0);
    let y = $derived(x * 2);
</script>

<slot {x} {y} />
