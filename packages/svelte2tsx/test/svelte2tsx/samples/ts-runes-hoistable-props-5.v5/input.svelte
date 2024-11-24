<script module>
    import X from './X';
</script>

<script lang="ts">
    import { readable } from 'svelte/store';
    
    const store = readable(1)
 
    /** I should not be sandwitched between the imports */
    interface Props {
        foo?: string;
    }
    let { foo }: Props = $props()
</script>

{$store}
