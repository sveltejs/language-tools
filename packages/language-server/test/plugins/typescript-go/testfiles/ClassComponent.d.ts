import { SvelteComponent } from 'svelte';

/** A component typed as a class, like the declarations of libraries built for Svelte 4 */
export default class ClassComponent extends SvelteComponent<
    { name: string },
    { change: CustomEvent<string> }
> {}
