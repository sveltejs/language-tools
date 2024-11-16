<script lang="ts" module>
    type Shadowed = string;
</script>

<script lang="ts">
    type Shadowed = boolean;
    let { someProp }: { someProp: Shadowed } = $props();
</script>
