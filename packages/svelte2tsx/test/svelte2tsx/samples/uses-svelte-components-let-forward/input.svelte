{#if true}
<svelte:self let:prop>
    <slot {prop} />
</svelte:self>
{/if}
<svelte:component this={testComponent} let:prop>
    <slot {prop} />
</svelte:component>
