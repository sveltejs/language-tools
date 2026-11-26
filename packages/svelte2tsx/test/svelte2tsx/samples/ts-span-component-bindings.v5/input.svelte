<script lang="ts">
    import Child from "./Child.svelte";
    let value = $state("");
</script>

<Child bind:value bind:other={value} />
