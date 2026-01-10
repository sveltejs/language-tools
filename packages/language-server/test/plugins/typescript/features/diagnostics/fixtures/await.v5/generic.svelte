<script lang="ts" generics="T">
    let { a, b }: { a: T[], b: T } = $props(); 

    await Promise.resolve();
</script>

{a} {b}
