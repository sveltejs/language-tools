/// <reference lib="dom" />
import type { SvelteComponentTyped as tmp } from 'svelte';
// @ts-ignore only exists in svelte 5+
import { Component } from 'svelte';

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

export class ComponentDef3 extends SvelteComponentTyped<
    { hi: string, hi2: string }
> {}

class ComponentDef3_ext extends SvelteComponentTyped<
    { hi: string, hi2: string, hi4: string }
> {}

export declare const Namespace2: {
    ComponentDef4: new (options: ConstructorParameters<typeof ComponentDef3>[0]) => ComponentDef3;
    ComponentDef7: {
        new (options: ConstructorParameters<typeof ComponentDef3>[0]): ComponentDef3
        new (options: ConstructorParameters<typeof ComponentDef3_ext>[0]): ComponentDef3_ext
    }
}

export declare const ComponentDef5: Component<{ hi: string }>;

export { ComponentDef3 as ComponentDef6 };
