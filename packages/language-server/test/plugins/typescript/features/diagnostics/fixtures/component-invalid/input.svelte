<script lang="ts">
    import Imported from './imported.svelte';
    import { Works, Works2, Works3, Works4, DoesntWork } from './components'
</script>

<!-- valid -->
<Works />
<Imported />
<Works2 hi="hi" on:click={e => console.log(e.movementX)} let:foo>
    {foo.toLocaleLowerCase()}
</Works2>
<Works3 />
<svelte:component this={Works} />
<svelte:component this={Works2}  hi="hi" on:click={e => console.log(e.movementX)} let:foo>
    {foo.toLocaleLowerCase()}
</svelte:component>
<svelte:component this={Works3} />

<!-- invalid -->
<DoesntWork />
<Imported propDoesntExist={true} />
<svelte:component this={DoesntWork} />

<!-- invalid, no additional errors for new transformation (everything else is any) -->
<DoesntWork foo="bar" on:click={() => ''} let:etc>
    {etc}
</DoesntWork>
<svelte:component this={DoesntWork} foo="bar" on:click={() => ''} let:etc>
    {etc}
</svelte:component>

<!-- valid in Svelte 5 -->
<Works4 foo="bar" />
<svelte:component this={Works4} foo="bar" />
