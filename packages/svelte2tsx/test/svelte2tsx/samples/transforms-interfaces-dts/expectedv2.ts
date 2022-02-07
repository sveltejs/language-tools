import { SvelteComponentTyped } from "svelte"

declare function __sveltets_1_createSvelteComponentTyped<Props, Events, Slots>(
    render: {props: Props, events: Events, slots: Slots }
): SvelteComponentConstructor<SvelteComponentTyped<Props, Events, Slots>,Svelte2TsxComponentConstructorParameters<Props>>;


import type { Foo } from './foo';
function render() {

    
     let foo: Foo;
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
     let bar: Bar3;
;
return { props: {foo: foo , bar: bar}, slots: {}, getters: {}, events: {} }}
const __propDef = __sveltets_1_partial(__sveltets_1_with_any_event(render()));
/** @typedef {typeof __propDef.props}  InputProps */
/** @typedef {typeof __propDef.events}  InputEvents */
/** @typedef {typeof __propDef.slots}  InputSlots */

export default class Input extends __sveltets_1_createSvelteComponentTyped(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}