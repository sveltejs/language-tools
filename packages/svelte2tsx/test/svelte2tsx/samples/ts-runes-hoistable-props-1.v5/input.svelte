<script module>
    let value = 1;
</script>

<script lang="ts">
    type NoComma = true
    type Dependency = {
        a: number;
        b: typeof value;
        c: NoComma
    }

    /** A comment */
    interface Props<T> {
        a: Dependency;
        b: T;
    }

    let { a, b }: Props<boolean> = $props();
</script>
