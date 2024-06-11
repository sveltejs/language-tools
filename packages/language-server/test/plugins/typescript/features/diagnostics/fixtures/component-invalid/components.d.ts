import { SvelteComponentTyped } from 'svelte';

export class Works extends SvelteComponentTyped<any, any, any> {}
export class Works2 extends SvelteComponentTyped<
    { hi: string },
    { click: MouseEvent },
    {
        default: {
            foo: string;
        };
    }
> {}
export class Works3 extends SvelteComponentTyped<
    any,
    { [evt: string]: CustomEvent<any> },
    Record<string, never>
> {}
// @ts-ignore doesn't exist in Svelte 4
export declare const Works4: import('svelte').Component<{ foo: string }>;
export class DoesntWork {}
