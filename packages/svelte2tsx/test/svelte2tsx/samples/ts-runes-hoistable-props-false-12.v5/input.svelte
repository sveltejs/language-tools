<script lang="ts">
const a = 1;

namespace A {
    export type Abc = typeof a
}

interface Abc {
    foo: A.Abc
}

let {}: Abc = $props();
</script>