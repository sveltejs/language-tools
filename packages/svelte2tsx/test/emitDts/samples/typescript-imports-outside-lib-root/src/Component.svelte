<script lang="ts">
    import { greet } from '../utils/helper';
    export let name: string = 'World';
    $: greeting = greet(name);
</script>

<p>{greeting}</p>
