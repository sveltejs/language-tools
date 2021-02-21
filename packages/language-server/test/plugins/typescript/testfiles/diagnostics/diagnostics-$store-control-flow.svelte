<script lang="ts">
import { writable } from 'svelte/store';
const store = writable<undefined | { a: string | { b: string | boolean }}>({a: 'hi'});
function isBoolean(t: string | boolean): t is boolean {
    return !!t;
}
let test: boolean;
if ($store) {
    if (typeof $store.a === 'string') {
        test = $store.a === 'string' || $store.a === true;
    } else {
        if (isBoolean($store.a.b)) {
            test = $store.a.b;
            test;
        } else {
            test = $store.a.b;
        }
    }
}
</script>

{#if $store}
    {#if typeof $store.a === 'string'}
        {test = $store.a === 'string' || $store.a === true}
    {:else}
        {#if isBoolean($store.a.b)}
            {test = $store.a.b}
        {:else}
            {test = $store.a.b}
        {/if}
    {/if}
{/if}
