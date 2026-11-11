<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLButtonAttributes } from 'svelte/elements';

    interface Props extends HTMLButtonAttributes {
        /** The variant */
        variant?: 'primary' | 'secondary';
        count?: number;
        children?: Snippet;
    }

    let { variant = 'primary', count = $bindable(0), children, ...rest }: Props = $props();

    export function reset(): void {
        count = 0;
    }
</script>

<!-- @component A button -->
<button {...rest} class={variant} onclick={() => count++}>{@render children?.()}</button>
