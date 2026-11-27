<script lang="ts">
    import { writable } from 'svelte/store';
    let a = 1;
    const b = 2;
    const store = writable(0);
    $: a, b, $store, console.log('changed');
    $: a;
</script>
