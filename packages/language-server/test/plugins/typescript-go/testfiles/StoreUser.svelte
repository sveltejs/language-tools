<script lang="ts">
    import { count } from './stores';

    function increment() {
        $count += 1;
    }
</script>

<button on:click={increment}>{$count}</button>
