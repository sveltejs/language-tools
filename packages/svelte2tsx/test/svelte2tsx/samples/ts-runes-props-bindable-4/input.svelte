<script lang="ts">
    type Foo = { a: string; b?: number }

    let { b = 1 }: Foo = $props();

    let { a }: Foo = $props.bindable();
</script>
