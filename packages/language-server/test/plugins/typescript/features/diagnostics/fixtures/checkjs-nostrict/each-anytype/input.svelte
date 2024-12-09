<script>
  let anyType;

  async function load() {
    anyType = (await (await fetch('')).json());
  }
  load();
</script>

{#each anyType as anyEntry}
    {anyEntry.asd()}
{/each}
