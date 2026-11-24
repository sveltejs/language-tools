<script lang="ts">
    import { greet } from '../utils/helper';
    let { name = 'World' }: { name?: string } = $props();
    const greeting = $derived(greet(name));
</script>

<p>{greeting}</p>
