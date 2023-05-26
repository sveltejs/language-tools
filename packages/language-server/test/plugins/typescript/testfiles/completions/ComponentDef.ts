/// <reference lib="dom" />
import type { SvelteComponentTyped as tmp } from 'svelte';

const SvelteComponentTyped: typeof tmp = null as any;

export class ComponentDef extends SvelteComponentTyped<
    {},
    {
        event1: CustomEvent<null>;
        /**
         * documentation for event2
         */
        event2: CustomEvent<string>;
    },
    {
        default: {
            let1: boolean;
            /**
             * documentation for let2
             */
            let2: string;
        };
    }
> {}

export class ComponentDef2 extends SvelteComponentTyped<
    {},
    | {
          event1: CustomEvent<number>;
      }
    | {
          event1: CustomEvent<string>;
      },
    {}
> {}
