<script lang="ts">
  import {} from 'svelte/elements'
  let tag: 'div' = 'div';
  let tagString: string = '';
  let elementDiv: HTMLDivElement;
  let elementOther: HTMLAnchorElement | HTMLButtonElement;
  let elementOther2: HTMLAnchorElement;

  () => {
    elementDiv;
    elementOther;
    elementOther2;
  }
</script>

<!-- valid -->
<svelte:element this={tag} />
<svelte:element this={tag}>{tag}</svelte:element>
<svelte:element this={tag} bind:this={elementDiv} on:click={() => tag} />
<svelte:element this={tagString} bind:this={elementOther} on:click={e => e.currentTarget} />

<!-- invalid -->
<svelte:element this={tag} bind:this={elementOther2} />
<svelte:element this={tag} cellpadding="{1}" />
