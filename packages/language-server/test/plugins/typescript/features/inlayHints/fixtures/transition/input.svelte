<script>
    import { fade } from 'svelte/transition';
</script>

<div transition:fade|local></div>
<div in:fade|local></div>
<div out:fade|local></div>
<div transition:fade|local={{ duration: 100 }}></div>
