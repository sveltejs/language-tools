<script module>
    let value = 1;
</script>

<script lang="ts">
    interface Dependency {
        a: number;
        b: typeof value;
    }

    let { a, b }: { a: Dependency, b: string } = $props();
</script>
