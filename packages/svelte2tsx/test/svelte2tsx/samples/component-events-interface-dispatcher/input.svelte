<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    interface $$Events {
        /**
         * Some *doc*
         */
        a: boolean;
        b: string;
        c;
    }

    const dispatch = createEventDispatcher();
</script>