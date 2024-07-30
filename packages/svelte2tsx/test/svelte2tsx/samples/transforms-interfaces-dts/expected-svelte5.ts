import { SvelteComponentTyped } from "svelte"

;
import type { Foo } from './foo';
function render() {

    
     let foo: Foo/*Ωignore_startΩ*/;foo = __sveltets_2_any(foo);/*Ωignore_endΩ*/;
    type Bar1 ={
        a: true;
    }
    type Bar2 = Bar1 &  {
        b: false;
    }
    type Bar3 = Bar1 & Bar2 &  {
        c: false;
    }
    type Bar4<T extends boolean> = Bar1 & Bar2 &  {
        c: false;
    }
     let bar: Bar3/*Ωignore_startΩ*/;bar = __sveltets_2_any(bar);/*Ωignore_endΩ*/;
;
async () => {};
return { props: {foo: foo , bar: bar}, exports: {}, bindings: "", slots: {}, events: {} }}
interface $$__sveltets_2_IsomorphicComponent<Props extends Record<string, any> = any, Events extends Record<string, any> = any, Slots extends Record<string, any> = any, Exports = {}, Bindings = string> {
    new (options: import('svelte').ComponentConstructorOptions<Props>): import('svelte').SvelteComponent<Props, Events, Slots> & { $$bindings?: Bindings } & Exports;
    (internal: unknown, props: Props & {$$events?: Events, $$slots?: Slots}): Exports & { $set?: any, $on?: any };
    z_$$bindings?: Bindings;
}

declare function $$__sveltets_2_isomorphic_component<
    Props extends Record<string, any>, Events extends Record<string, any>, Slots extends Record<string, any>, Exports extends Record<string, any>, Bindings extends string
>(klass: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }): $$__sveltets_2_IsomorphicComponent<Props, Events, Slots, Exports, Bindings>;
const Input = $$__sveltets_2_isomorphic_component(__sveltets_2_partial(__sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input = InstanceType<typeof Input>;
/*Ωignore_endΩ*/export default Input;