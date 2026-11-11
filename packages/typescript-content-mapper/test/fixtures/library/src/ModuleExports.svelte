<script module lang="ts">
    export type Size = 'small' | 'large';
    export const sizes: Size[] = ['small', 'large'];
    export function isSize(value: string): value is Size {
        return (sizes as string[]).includes(value);
    }
</script>

<script lang="ts">
    let { size = 'small' }: { size?: Size } = $props();
</script>

<span>{size}</span>
