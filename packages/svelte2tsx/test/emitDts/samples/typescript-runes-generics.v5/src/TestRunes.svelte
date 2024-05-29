<script lang="ts" generics="T extends Record<string, any>, K extends keyof T">
    let { foo, bar = $bindable() }: { foo: T, bar?: K } = $props();

    export function baz(): T {}
</script>
