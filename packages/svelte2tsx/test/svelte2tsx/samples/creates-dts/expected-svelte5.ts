import { SvelteComponentTyped } from "svelte"

;
    export const foo = 'foo';
;;

import { createEventDispatcher } from 'svelte';
function render() {

  

  /** @type {boolean} */
   let bar/*Ωignore_startΩ*/;bar = __sveltets_2_any(bar);/*Ωignore_endΩ*/;
   let foobar = '';

  const dispatch = createEventDispatcher();
  dispatch('hi');
;
async () => {



 { svelteHTML.createElement("button", { "on:click":undefined,});  }
 { __sveltets_createSlot("default", {bar,}); }};
return { props: {
/** @type {boolean} */bar: bar , foobar: foobar}, exports: {}, bindings: "", slots: {'default': {bar:bar}}, events: {'click':__sveltets_2_mapElementEvent('click'), 'hi': __sveltets_2_customEvent} }}
interface $$__sveltets_2_IsomorphicComponent<Props extends Record<string, any> = any, Events extends Record<string, any> = any, Slots extends Record<string, any> = any, Exports = {}, Bindings = string> {
    new (options: import('svelte').ComponentConstructorOptions<Props>): import('svelte').SvelteComponent<Props, Events, Slots> & { $$bindings?: Bindings } & Exports;
    (internal: unknown, props: Props & {$$events?: Events, $$slots?: Slots}): Exports & { $set?: any, $on?: any };
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
const Input = $$__sveltets_2_isomorphic_component_slots(__sveltets_2_partial(['foobar'], __sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input = InstanceType<typeof Input>;
/*Ωignore_endΩ*/export default Input;