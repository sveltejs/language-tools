<script lang="ts">
    function log(message: any): void {}
</script>

<button on:click></button>
<button on:click={e => log(e)}></button>