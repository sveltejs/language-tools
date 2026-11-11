<script lang="ts" module>
    // Named like the component, so the component's declaration keeps its generated name
    export interface Clash {
        label: string;
    }
</script>

<script lang="ts">
    let { label }: Clash = $props();
</script>

<span>{label}</span>
