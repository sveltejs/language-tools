<script lang="ts">
    import Child from "./Child.svelte";
    let v = $state("");
</script>

<Child bind:value={v} bind:readonly={v} />
