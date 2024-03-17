<script lang="ts">
    let { a, b = 1 }: { a: string; b?: number } = $props.bindable();
</script>
