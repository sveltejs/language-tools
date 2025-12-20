<script lang="ts">
    let { foo, bar = $bindable() }: { foo: string, bar?: number } = $props();

    export function baz() {}
</script>
