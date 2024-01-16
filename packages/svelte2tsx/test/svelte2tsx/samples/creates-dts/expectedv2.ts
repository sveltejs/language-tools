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
/** @type {boolean} */bar: bar , foobar: foobar}, slots: {'default': {bar:bar}}, events: {'click':__sveltets_2_mapElementEvent('click'), 'hi': __sveltets_2_customEvent} }}
const __propDef = __sveltets_2_partial(['foobar'], __sveltets_2_with_any_event(render()));
/** @typedef {typeof __propDef.props}  InputProps */
/** @typedef {typeof __propDef.events}  InputEvents */
/** @typedef {typeof __propDef.slots}  InputSlots */

export default class Input extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['foobar'], __sveltets_2_with_any_event(render()))) {
}