<script lang="ts">
    type Foo = { a: string; b?: number }

    let { a, b = 1 }: Foo = $props.bindable();
</script>
