<script lang="ts" generics="T">
    let { value, defaultValue }: { value: T; defaultValue?: T } = $props();
</script>

{value}
{defaultValue}