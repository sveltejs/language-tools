import { SvelteComponentTyped } from "svelte"


    export const foo = 'foo';
;
import Bar from './bar';
import { createEventDispatcher } from 'svelte';
function render() {

  
  

   let bar: Bar;
   let foobar = '';

  const dispatch = createEventDispatcher<{swipe: string}>();
;
return { props: {bar: bar , foobar: foobar} as {bar: Bar, foobar?: typeof foobar}, slots: {'default': {bar:bar}}, getters: {}, events: {...__sveltets_1_toEventTypings<{swipe: string}>(), 'click':__sveltets_1_mapElementEvent('click')} }}
const __propDef = __sveltets_1_with_any_event(render());
export type InputProps = typeof __propDef.props;
export type InputEvents = typeof __propDef.events;
export type InputSlots = typeof __propDef.slots;

export default class Input extends SvelteComponentTyped<InputProps, InputEvents, InputSlots> {
}