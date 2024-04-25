<script lang="ts">
    let { readonly, can_bind = $bindable() }: { readonly?: string; can_bind?: string } = $props();

    export function only_bind() {
        return true;
    }
</script>
