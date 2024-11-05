<script>
    import { findMe } from './find-references-$store.svelte';
    if ($findMe) {
        $findMe;
    }
</script>

{$findMe}
