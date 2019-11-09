declare module '*.svelte' {
    export default class {
        props: any;
    }
}

type AConstructorTypeOf<T> = new (...args:any[]) => T;

type SvelteAction<U extends any[]> = (node: HTMLElement, ...args:U) => {
	update?: (...args:U) => void,
	destroy?: () => void
}

declare function __sveltets_ensureAction<U extends any[]>(action: SvelteAction<U>, ...args: U): any[];

declare function __sveltets_ensureFunction(expression: (e: Event) => unknown ):any[];

declare function __sveltets_ensureType<T>(type: AConstructorTypeOf<T>, el: T): any[];