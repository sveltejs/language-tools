import { SvelteComponentTyped } from "svelte"

;function render() {
async () => { { svelteHTML.createElement("button", { "on:click":undefined,}); { __sveltets_createSlot("default", {});} }
   { const $$_value = await (Promise.resolve(0));{ const n = $$_value; 
  n;
}}};
return { props: /** @type {Record<string, never>} */ ({}), exports: {}, bindings: "", slots: {'default': {}}, events: {'click':__sveltets_2_mapElementEvent('click')} }}
interface $$__sveltets_2_IsomorphicComponent<Props extends Record<string, any> = any, Events extends Record<string, any> = any, Slots extends Record<string, any> = any, Exports = {}, Bindings = string> {
    new (options: import('svelte').ComponentConstructorOptions<Props>): import('svelte').SvelteComponent<Props, Events, Slots> & { $$bindings?: Bindings } & Exports;
    (internal: unknown, props: {$$events?: Events, $$slots?: Slots}): Exports & { $set?: any, $on?: any };
    z_$$bindings?: Bindings;
}
type $$__sveltets_2_PropsWithChildren<Props, Slots> = Props &
    (Slots extends { default: any }
        ? Props extends Record<string, never>
        ? any
        : { children?: any }
        : {});
        declare function $$__sveltets_2_isomorphic_component_slots<
            Props extends Record<string, any>, Events extends Record<string, any>, Slots extends Record<string, any>, Exports extends Record<string, any>, Bindings extends string
        >(klass: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }): $$__sveltets_2_IsomorphicComponent<$$__sveltets_2_PropsWithChildren<Props, Slots>, Events, Slots, Exports, Bindings>;
const Input = $$__sveltets_2_isomorphic_component_slots(__sveltets_2_partial(__sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input = InstanceType<typeof Input>;
/*Ωignore_endΩ*/export default Input;