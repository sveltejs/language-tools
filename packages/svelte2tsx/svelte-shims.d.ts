declare module '*.svelte' {
    export default Svelte2TsxComponent
}

declare class Svelte2TsxComponent<
    Props extends {} = {},
    Events extends {} = {},
    Slots extends {} = {}
> {
    // svelte2tsx-specific
    /**
     * @internal This is for type checking capabilities only
     * and does not exist at runtime. Don't use this property.
     */
    $$prop_def: Props;
    /**
     * @internal This is for type checking capabilities only
     * and does not exist at runtime. Don't use this property.
     */
    $$events_def: Events;
    /**
     * @internal This is for type checking capabilities only
     * and does not exist at runtime. Don't use this property.
     */
    $$slot_def: Slots;
    // https://svelte.dev/docs#Client-side_component_API
    constructor(options: {
        /**
         * An HTMLElement to render to. This option is required.
         */
        target: Element;
        /**
         * A child of `target` to render the component immediately before.
         */
        anchor?: Element;
        /**
         * An object of properties to supply to the component.
         */
        props?: Props;
        hydrate?: boolean;
        intro?: boolean;
        $$inline?: boolean;
    });
    /**
     * Causes the callback function to be called whenever the component dispatches an event.
     * A function is returned that will remove the event listener when called.
     */
    $on<K extends keyof Events>(event: K, handler: (e: Events[K]) => any): () => void;
    /**
     * Removes a component from the DOM and triggers any `onDestroy` handlers.
     */
    $destroy(): void;
    /**
     * Programmatically sets props on an instance.
     * `component.$set({ x: 1 })` is equivalent to `x = 1` inside the component's `<script>` block.
     * Calling this method schedules an update for the next microtask — the DOM is __not__ updated synchronously.
     */
    $set(props: Partial<Props>): void;
    // From SvelteComponent(Dev) definition
    $$: any;
    $capture_state(): void;
    $inject_state(): void;
}

type AConstructorTypeOf<T> = new (...args: any[]) => T;

type SvelteAction<U extends any[], El extends any> = (node: El, ...args:U) => {
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
type SvelteSlots = { [index: string]: any }
type SvelteStore<T> = { subscribe: (run: (value: T) => any, invalidate?: any) => any }


declare var process: NodeJS.Process & { browser: boolean }

declare function __sveltets_ensureAnimation<U extends any[]>(animation: SvelteAnimation<U>, ...args: U): {};
declare function __sveltets_ensureAction<U extends any[], El extends any>(
    el: El,
    action: SvelteAction<U, El>,
    ...args: U
): {};
declare function __sveltets_ensureTransition<U extends any[]>(transition: SvelteTransition<U>, ...args: U): {};
declare function __sveltets_ensureFunction(expression: (e: Event & { detail?: any }) => unknown ): {};
declare function __sveltets_ensureType<T>(type: AConstructorTypeOf<T>, el: T): {};
declare function __sveltets_ctorOf<T>(type: T): AConstructorTypeOf<T>;
declare function __sveltets_instanceOf<T>(type: AConstructorTypeOf<T>): T;
declare function __sveltets_allPropsType(): SvelteAllProps
declare function __sveltets_restPropsType(): SvelteRestProps
declare function __sveltets_slotsType<Slots, Key extends keyof Slots>(slots: Slots): Record<Key, boolean>;
declare function __sveltets_partial<Props = {}, Events = {}, Slots = {}>(
    render: () => {props?: Props, events?: Events, slots?: Slots }
): () => {props?: Partial<Props>, events?: Events, slots?: Slots }
declare function __sveltets_partial_with_any<Props = {}, Events = {}, Slots = {}>(
    render: () => {props?: Props, events?: Events, slots?: Slots }
): () => {props?: Partial<Props> & SvelteAllProps, events?: Events, slots?: Slots }
declare function __sveltets_with_any<Props = {}, Events = {}, Slots = {}>(
    render: () => {props?: Props, events?: Events, slots?: Slots }
): () => {props?: Props & SvelteAllProps, events?: Events, slots?: Slots }
declare function __sveltets_with_any_event<Props = {}, Events = {}, Slots = {}>(
    render: () => {props?: Props, events?: Events, slots?: Slots }
): () => {props?: Props, events?: Events & {[evt: string]: CustomEvent<any>;}, slots?: Slots }
declare function __sveltets_store_get<T = any>(store: SvelteStore<T>): T
declare function __sveltets_any(dummy: any): any;
declare function __sveltets_empty(dummy: any): {};
declare function __sveltets_componentType(): AConstructorTypeOf<Svelte2TsxComponent<any, any, any>>
declare function __sveltets_invalidate<T>(getValue: () => T): T

declare function __sveltets_mapWindowEvent<K extends keyof HTMLBodyElementEventMap>(
    event: K
): HTMLBodyElementEventMap[K];
declare function __sveltets_mapBodyEvent<K extends keyof WindowEventMap>(
    event: K
): WindowEventMap[K];
declare function __sveltets_mapElementEvent<K extends keyof HTMLElementEventMap>(
    event: K
): HTMLElementEventMap[K];
declare function __sveltets_mapElementTag<K extends keyof ElementTagNameMap>(
    tag: K
): ElementTagNameMap[K];
declare function __sveltets_mapElementTag<K extends keyof SVGElementTagNameMap>(
    tag: K
): SVGElementTagNameMap[K];
declare function __sveltets_mapElementTag(
    tag: any
): HTMLElement;

declare function __sveltets_bubbleEventDef<Events, K extends keyof Events>(
    events: Events, eventKey: K
): Events[K];
declare function __sveltets_bubbleEventDef(
    events: any, eventKey: string
): any;

declare const __sveltets_customEvent: CustomEvent<any>;
declare function __sveltets_toEventTypings<Typings>(): {[Key in keyof Typings]: CustomEvent<Typings[Key]>};

declare function __sveltets_unionType<T1, T2>(t1: T1, t2: T2): T1 | T2;
declare function __sveltets_unionType<T1, T2, T3>(t1: T1, t2: T2, t3: T3): T1 | T2 | T3;
declare function __sveltets_unionType<T1, T2, T3, T4>(t1: T1, t2: T2, t3: T3, t4: T4): T1 | T2 | T3 | T4;
declare function __sveltets_unionType(...types: any[]): any;

declare function __sveltets_awaitThen<T>(
    promise: T,
    onfulfilled: (value: T extends PromiseLike<infer U> ? U : T) => any,
    onrejected?: (value: T extends PromiseLike<any> ? any : never) => any
): any;

declare function __sveltets_each<T>(
    array: ArrayLike<T>,
    callbackfn: (value: T, index: number) => any
): any;

declare function createSvelte2TsxComponent<Props, Events, Slots>(
    render: () => {props?: Props, events?: Events, slots?: Slots }
): AConstructorTypeOf<Svelte2TsxComponent<Props, Events, Slots>>;

declare function __sveltets_unwrapArr<T>(arr: ArrayLike<T>): T
declare function __sveltets_unwrapPromiseLike<T>(promise: PromiseLike<T> | T): T
