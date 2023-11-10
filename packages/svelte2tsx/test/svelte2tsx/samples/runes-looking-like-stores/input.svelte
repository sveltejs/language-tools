<script>
    let { props } = $props();
    let state = $state(0);
    let derived = $derived(state * 2);
</script>

{state} {derived}
