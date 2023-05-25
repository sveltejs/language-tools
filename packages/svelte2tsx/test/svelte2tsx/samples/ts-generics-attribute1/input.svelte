<script lang="ts" generics="A, B extends keyof A, C extends boolean">
    import { createEventDispatcher } from 'svelte';

    export let a: A;
    export let b: B;
    export let c: C;

    const dispatch = createEventDispatcher<{a: A}>();

    export function getA() {
        return a;
    }
</script>

<slot {c} />
