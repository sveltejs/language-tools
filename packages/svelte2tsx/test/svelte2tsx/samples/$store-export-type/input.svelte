<script>
    import type { Writable } from "svelte/store";
    
    export let store: Writable<string[]> | null = null;
    
    if ($store) {
        $store.length
    }
</script>
