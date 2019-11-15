declare module '*.svelte' {
    export default class {
		$$prop_def: any;
		$$slot_def: any;
    }
}

type AConstructorTypeOf<T> = new (...args:any[]) => T;

type SvelteAction<U extends any[]> = (node: HTMLElement, ...args:U) => {
	update?: (...args:U) => void,
	destroy?: () => void
}

type SvelteTransition<U extends any[]> = (node: HTMLElement, ...args:U) => {
    delay?: number,
	duration?: number,
	easing?: (t: number) => number,
	css?: (t: number, u: number) => string,
	tick?: (t: number, u: number) => void
}

type SvelteAnimation<U extends any[]> = (node: HTMLElement, move: { from: DOMRect, to: DOMRect}, ...args:U) => {
    delay?: number,
	duration?: number,
	easing?: (t: number) => number,
	css?: (t: number, u: number) => string,
	tick?: (t: number, u: number) => void
}

declare function __sveltets_ensureAnimation<U extends any[]>(animation: SvelteAnimation<U>, ...args: U): any[];

declare function __sveltets_ensureAction<U extends any[]>(action: SvelteAction<U>, ...args: U): any[];

declare function __sveltets_ensureTransition<U extends any[]>(transition: SvelteTransition<U>, ...args: U): any[];

declare function __sveltets_ensureFunction(expression: (e: Event) => unknown ):any[];

declare function __sveltets_ensureType<T>(type: AConstructorTypeOf<T>, el: T): any[];
declare function __sveltets_instanceOf<T>(type: AConstructorTypeOf<T>): T;