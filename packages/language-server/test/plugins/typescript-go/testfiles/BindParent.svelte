<script lang="ts">
    import BindChild from './BindChild.svelte';
    import BindableChild from './BindableChild.svelte';

    let count = $state(0);
</script>

<BindableChild bind:value={count} />
<BindChild bind:value={count} />
