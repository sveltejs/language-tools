<script lang="ts">
    let count   =  1;
    function   increment() {
        count++;
    }
</script>

<button onclick={increment}>{count}</button>
{#if count>1}
    <p>{count*2}</p>
{/if}
