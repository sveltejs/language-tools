<script generics="A, B extends keyof A, C extends boolean">
    /** @type {{ a: A; b: B; c: C }} */
    const { a, b, c } = $props();

    export function getA() {
        return a;
    }
</script>
