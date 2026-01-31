<script lang="ts">
    // no error
    top
</script>

<!--no error-->
<div>
    <!-- {@render nested1()} -->
    {#snippet nested1()}{/snippet}
    {@render nested1()}
</div>

{#snippet top()}{/snippet}

<!--error-->
{@render nested1()}