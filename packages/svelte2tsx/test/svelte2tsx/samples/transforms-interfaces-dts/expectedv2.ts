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
return { props: {foo: foo , bar: bar}, slots: {}, events: {} }}
const __propDef = __sveltets_2_partial(__sveltets_2_with_any_event(render()));
/** @typedef {typeof __propDef.props}  InputProps */
/** @typedef {typeof __propDef.events}  InputEvents */
/** @typedef {typeof __propDef.slots}  InputSlots */

export default class Input extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}