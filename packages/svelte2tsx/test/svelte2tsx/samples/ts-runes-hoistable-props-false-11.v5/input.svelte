<script lang="ts">
    const a = 1;

interface A {
    Abc: typeof a
}

interface Abc {
    foo: A.Abc
}

let {}: Abc = $props();
</script>