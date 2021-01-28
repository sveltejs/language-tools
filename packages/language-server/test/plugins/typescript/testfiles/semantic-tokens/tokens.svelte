<script lang="ts">
    interface TextContent {
        text: string,
    }

    export let textPromise: Promise<TextContent>;

    async function blurHandler() {}
</script>

{#await textPromise then text}
    <textarea on:blur={blurHandler} value={text.text} />
{/await}
{#each ['a'] as a}
    {a}
{/each}
