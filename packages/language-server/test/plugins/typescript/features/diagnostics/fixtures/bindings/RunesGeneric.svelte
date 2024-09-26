<script lang="ts" generics="T">
    let { readonly, can_bind = $bindable() }: { readonly?: T; can_bind?: T } = $props();

    export function only_bind() {
        return true;
    }
</script>
