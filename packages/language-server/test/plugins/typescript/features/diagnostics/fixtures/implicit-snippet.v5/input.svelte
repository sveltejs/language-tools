<script lang="ts">
    import SnippetParent from "./SnippetParent.svelte";
</script>

<SnippetParent>
    {#snippet foo(a)}
        {a === 'b'}
    {/snippet}

    <!--TODO-->
    <!-- {@render foo('a')} -->
</SnippetParent>