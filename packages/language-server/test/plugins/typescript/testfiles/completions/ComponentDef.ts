/// <reference lib="dom" />
import { SvelteComponentTyped } from 'svelte';

export class ComponentDef extends SvelteComponentTyped<
    {},
    {
        event1: CustomEvent<null>;
        /**
         * documentation for event2
         */
        event2: CustomEvent<string>;
    },
    {}
> {}
