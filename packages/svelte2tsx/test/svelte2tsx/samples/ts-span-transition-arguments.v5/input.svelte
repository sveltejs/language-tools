<script lang="ts">
    import { fade } from 'svelte/transition';
    function three(_node: HTMLElement, _params: { delay: number }, _options: { direction: 'in' | 'out' | 'both' }) {
        return {};
    }
</script>

<div in:three={{ delay: 1 }} out:fade transition:fade|global={{ duration: 1 }} />
