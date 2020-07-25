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


type SvelteTransitionConfig = {
	delay?: number,
	duration?: number,
	easing?: (t: number) => number,
	css?: (t: number, u: number) => string,
	tick?: (t: number, u: number) => void
}

type SvelteTransition<U extends any[]> = (node: Element, ...args:U) => SvelteTransitionConfig | (() => SvelteTransitionConfig)

type SvelteAnimation<U extends any[]> = (node: Element, move: { from: DOMRect, to: DOMRect}, ...args:U) => {
    delay?: number,
	duration?: number,
	easing?: (t: number) => number,
	css?: (t: number, u: number) => string,
	tick?: (t: number, u: number) => void
}

type SvelteAllProps = {	[index: string]: any }
type SvelteRestProps = { [index: string]: any }
type SvelteStore<T> =  { subscribe: (run: (value:T) => any, invalidate?: any) => any }
type SvelteComponent = import('*.svelte').default

declare var process: NodeJS.Process & { browser: boolean }

declare function __sveltets_ensureAnimation<U extends any[]>(animation: SvelteAnimation<U>, ...args: U): {};
declare function __sveltets_ensureAction<U extends any[]>(action: SvelteAction<U>, ...args: U): {};
declare function __sveltets_ensureTransition<U extends any[]>(transition: SvelteTransition<U>, ...args: U): {};
declare function __sveltets_ensureFunction(expression: (e: Event & { detail?: any }) => unknown ): {};
declare function __sveltets_ensureType<T>(type: AConstructorTypeOf<T>, el: T): {};
declare function __sveltets_instanceOf<T>(type: AConstructorTypeOf<T>): T;
declare function __sveltets_allPropsType(): SvelteAllProps
declare function __sveltets_restPropsType(): SvelteRestProps
declare function __sveltets_partial<T>(obj: T): Partial<T>;
declare function __sveltets_partial_with_any<T>(obj: T): Partial<T> & SvelteAllProps
declare function __sveltets_with_any<T>(obj: T): T & SvelteAllProps
declare function __sveltets_store_get<T=any>(store: SvelteStore<T>): T
declare function __sveltets_any(dummy: any): any;
declare function __sveltets_empty(dummy: any): {};
declare function __sveltets_componentType(): AConstructorTypeOf<SvelteComponent>
declare function __sveltets_invalidate<T>(getValue: () => T): T
