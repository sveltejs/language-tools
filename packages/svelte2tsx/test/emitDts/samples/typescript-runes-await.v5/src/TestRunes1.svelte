<script lang="ts" generics="T extends Record<string, any>, K extends keyof T">
    let { foo, bar = $bindable() }: { foo: T, bar?: K } = $props();

    await Promise.resolve();
</script>
