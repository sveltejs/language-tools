import { SvelteComponentTyped } from 'svelte';

export class ComponentDef extends SvelteComponentTyped<
    {},
    { event1: CustomEvent<null>; event2: CustomEvent<string> },
    {}
> {}
