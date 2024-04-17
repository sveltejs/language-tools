<script lang="ts">
    export let value: 'foo' | 'bar';
</script>

<button on:click={() => value = 'foo'}>foo</button>
