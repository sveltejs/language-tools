<script lang="ts" generics="T">
    let { foo, bar = $bindable() }: { foo: T, bar?: T } = $props();
</script>

{foo}
{bar}