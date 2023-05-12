import { readable, writable } from 'svelte/store';

export const someStore = readable(1);
export const someOtherStore = writable(1);
