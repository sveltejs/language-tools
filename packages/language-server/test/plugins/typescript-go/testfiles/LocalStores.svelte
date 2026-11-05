<script lang="ts">
    import { writable } from 'svelte/store';

    const local = writable(1);
    const { inner: destructured } = { inner: writable('') };

    function shadow() {
        const local = 5;
        return local;
    }
</script>

<p>{$local} {$destructured} {shadow()}</p>
