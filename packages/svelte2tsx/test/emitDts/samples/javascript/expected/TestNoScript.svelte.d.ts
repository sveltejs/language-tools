export default TestNoScript;
type TestNoScript = SvelteComponent<any, {
    click: PointerEvent;
} & {
    [evt: string]: CustomEvent<any>;
}, {
    default: {};
}> & {
    $$bindings?: string;
};
declare const TestNoScript: $$__sveltets_2_IsomorphicComponent<any, {
    click: PointerEvent;
} & {
    [evt: string]: CustomEvent<any>;
}, {
    default: {};
}, {}, string>;
interface $$__sveltets_2_IsomorphicComponent<Props extends Record<string, any> = any, Events extends Record<string, any> = any, Slots extends Record<string, any> = any, Exports = {}, Bindings = string> {
    new (options: import("svelte").ComponentConstructorOptions<Props>): import("svelte").SvelteComponent<Props, Events, Slots> & {
        $$bindings?: Bindings;
    } & Exports;
    (internal: unknown, props: {
        $$events?: Events;
        $$slots?: Slots;
    }): Exports & {
        $set?: any;
        $on?: any;
    };
    z_$$bindings?: Bindings;
}
