<script lang="ts">
    let { b = 1 }: {b?: number} = $props();

    let { a }: {a: string} = $props.bindable();
</script>
