<script>
    import RenameRunes from "./rename-runes.svelte";
    let foo = $state('');
    let bar = $state('');
</script>

<RenameRunes {foo} bind:bar />
<RenameRunes foo={foo} bind:bar={bar} />
