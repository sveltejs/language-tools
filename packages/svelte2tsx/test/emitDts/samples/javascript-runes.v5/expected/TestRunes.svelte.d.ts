/// <reference types="svelte" />
interface $$__sveltets_2_IsomorphicComponent<Props extends Record<string, any> = any, Events extends Record<string, any> = any, Slots extends Record<string, any> = any, Exports = {}, Bindings = string> {
    new (options: import('svelte').ComponentConstructorOptions<Props>): import('svelte').SvelteComponent<Props, Events, Slots> & {
        $$bindings?: Bindings;
    } & Exports;
    (internal: unknown, props: Props & {
        $$events?: Events;
        $$slots?: Slots;
    }): import('svelte').SvelteComponent<Props, Events, Slots> & {
        $$bindings?: Bindings;
    } & Exports;
}
declare const TestRunes: $$__sveltets_2_IsomorphicComponent<{
    foo: string;
    bar?: number;
}, {
    [evt: string]: CustomEvent<any>;
}, {}, {
    baz: () => void;
}, "bar">;
type TestRunes = InstanceType<typeof TestRunes>;
export default TestRunes;
