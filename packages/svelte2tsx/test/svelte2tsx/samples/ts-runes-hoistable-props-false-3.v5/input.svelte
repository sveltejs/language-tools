<script lang="ts" module>
    type SomeType<T extends boolean> = T;
    type T = unknown;
</script>

<script lang="ts" generics="T extends boolean">
    let { someProp }: { someProp: SomeType<T>; } = $props();
</script>
