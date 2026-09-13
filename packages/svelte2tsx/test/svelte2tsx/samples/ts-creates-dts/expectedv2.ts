import { SvelteComponentTyped } from "svelte"

;
    export const foo = 'foo';
;;

  import Bar from './bar';
  import { createEventDispatcher } from 'svelte';
function $$render() {


   let bar: Bar/*Ωignore_startΩ*/;bar = __sveltets_2_any(bar);/*Ωignore_endΩ*/;
   let foobar = '';

  const dispatch = createEventDispatcher<{swipe: string}>();
;
async () => {



 { svelteHTML.createElement("button", { "on:click":undefined,});  }
 { __sveltets_createSlot("default", {bar,}); }};
return { props: {bar: bar , foobar: foobar} as {bar: Bar, foobar?: typeof foobar}, slots: {'default': {bar:bar}}, events: {...__sveltets_2_toEventTypings<{swipe: string}>(), 'click':__sveltets_2_mapElementEvent('click')} }}
const __propDef = __sveltets_2_with_any_event($$render());
export type InputProps = typeof __propDef.props;
export type InputEvents = typeof __propDef.events;
export type InputSlots = typeof __propDef.slots;

export default class Input extends SvelteComponentTyped<InputProps, InputEvents, InputSlots> {
}