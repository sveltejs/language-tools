<script>
    import Component from '$lib/Component.svelte';
    export let data;
</script>

{data}
<Component b={(v) => console.log(v)} />
