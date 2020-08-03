declare module '*.svelte' {
    export default Svelte2TsxComponent
}

declare class Svelte2TsxComponent<Props = any, Events = {}, Slots = any> {
    // svelte2tsx-specific
    $$prop_def: Props;
    $$slot_def: Slots;
    // https://svelte.dev/docs#Client-side_component_API
    constructor(options: {
        target: Element;
        anchor?: Element;
        props?: Props;
        hydrate?: boolean;
        intro?: boolean;
        $$inline?: boolean;
    });
    $on: SvelteOnAllEvent<Events>;
    $destroy(): void;
    $set(props: Partial<Props>): void;
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
type SvelteEventRecord = Record<string, Event | Event[]>
type SvelteExtractEvent<T> = T extends any[] ? T[number] : T;
type SvelteOnEvent<T, K extends keyof T> = (
    event: K,
    handler: (e: SvelteExtractEvent<T[K]>) => any
) => () => void;
type SvelteRestEvent = (event: string, handler: (e: CustomEvent) => any) => () => void
type SvelteOnAllEvent<T> = SvelteOnEvent<T, keyof T> & SvelteRestEvent

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
declare function __sveltets_componentType(): AConstructorTypeOf<Svelte2TsxComponent>
declare function __sveltets_invalidate<T>(getValue: () => T): T
declare function __sveltets_eventDef<T extends SvelteEventRecord>(def: T): SvelteOnAllEvent<T>
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
>(on: SvelteOnAllEvent<T>, event: TEvent): T[TKey];

declare function __sveltets_awaitThen<T>(
    promise: PromiseLike<T>,
    onfulfilled: (value: T) => any,
    onrejected?: (value: any) => any
): any;
declare function __sveltets_awaitThen<T>(
    promise: T,
    onfulfilled: (value: T) => any,
    onrejected?: (value: never) => any
): any;

declare function __sveltets_each<T>(
    array: ArrayLike<T>,
    callbackfn: (value: T, index: number) => any
): any;

declare function createSvelte2TsxComponent<Props = {}, Events = {}, Slots = {}>(
    render: () => {props?: Props, events?: Events, slots?: Slots }
): AConstructorTypeOf<Svelte2TsxComponent<Props, Events, Slots>>;
