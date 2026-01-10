<script lang="ts" module>
    let a = '';
</script>

<script lang="ts">
    let a = true;
    let { someProp }: { someProp: typeof a } = $props();
</script>
