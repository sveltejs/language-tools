declare module '*.svelte' {
    export default class {
        $$prop_def: any;
        $$slot_def: any;

        $on(event: string, handler: (e: Event) => any): () => void
    }
}

type AConstructorTypeOf<T> = new (...args: any[]) => T;

type SvelteAction<U extends any[]> = (node: HTMLElement, ...args:U) => {
	update?: (...args:U) => void,
	destroy?: () => void
} | void

type SvelteTransitionConfig = {
    delay?: number,
    duration?: number,
    easing?: (t: number) => number,
    css?: (t: number, u: number) => string,
    tick?: (t: number, u: number) => void
}

type SvelteTransition<U extends any[]> = (node: Element, ...args: U) => SvelteTransitionConfig | (() => SvelteTransitionConfig)

type SvelteAnimation<U extends any[]> = (node: Element, move: { from: DOMRect, to: DOMRect }, ...args: U) => {
    delay?: number,
    duration?: number,
    easing?: (t: number) => number,
    css?: (t: number, u: number) => string,
    tick?: (t: number, u: number) => void
}

type SvelteAllProps = { [index: string]: any }
type SvelteRestProps = { [index: string]: any }
type SvelteStore<T> = { subscribe: (run: (value: T) => any, invalidate?: any) => any }
type SvelteComponent = import('*.svelte').default
type SvelteEventRecord = Record<string, Event | Event[]>
type SvelteExtractEvent<T> = T extends any[] ? T[number] : T;
type SvelteEventOnEvent<T, K extends keyof T> = (
    event: K,
    handler: (e: SvelteExtractEvent<T[K]>) => any
) => () => void;
type SvelteAllEvent = (event: string, handler: (e: CustomEvent) => any) => () => void
type SvelteOnEvent<T> = SvelteEventOnEvent<T, keyof T> & SvelteAllEvent

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
declare function __sveltets_store_get<T = any>(store: SvelteStore<T>): T
declare function __sveltets_any(dummy: any): any;
declare function __sveltets_empty(dummy: any): {};
declare function __sveltets_componentType(): AConstructorTypeOf<SvelteComponent>
declare function __sveltets_invalidate<T>(getValue: () => T): T
declare function __sveltets_eventDef<T extends SvelteEventRecord>(def: T): SvelteOnEvent<T>
declare function __sveltets_mapWindowEvent<K extends keyof HTMLBodyElementEventMap>(
    event: K
): HTMLBodyElementEventMap[K];
declare function __sveltets_mapBodyEvent<K extends keyof WindowEventMap>(
    event: K
): WindowEventMap[K];
declare function __sveltets_mapElementEvent<K extends keyof HTMLElementEventMap>(
    event: K
): HTMLElementEventMap[K];
declare function __sveltets_bubbleEventDef<
    T extends SvelteEventRecord,
    TEvent,
    TKey extends keyof T = TEvent extends keyof T ? TEvent : string
>(componentDef: SvelteOnEvent<T>, event: TEvent): T[TKey];
