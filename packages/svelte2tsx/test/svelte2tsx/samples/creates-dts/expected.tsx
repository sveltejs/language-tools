import { SvelteComponentTyped } from "svelte"

declare function __sveltets_1_createSvelteComponentTyped<Props, Events, Slots>(
    render: {props: Props, events: Events, slots: Slots }
): SvelteComponentConstructor<SvelteComponentTyped<Props, Events, Slots>,Svelte2TsxComponentConstructorParameters<Props>>;


    export const foo = 'foo';
;
import { createEventDispatcher } from 'svelte';
function render() {

  

  /** @type {boolean} */
   let bar;
   let foobar = '';

  const dispatch = createEventDispatcher();
  dispatch('hi');
;
return { props: {
/** @type {boolean} */bar: bar , foobar: foobar}, slots: {'default': {bar:bar}}, getters: {}, events: {'click':__sveltets_1_mapElementEvent('click'), 'hi': __sveltets_1_customEvent} }}
const __propDef = __sveltets_1_partial(['foobar'], __sveltets_1_with_any_event(render()));
/** @typedef {typeof __propDef.props}  InputProps */
/** @typedef {typeof __propDef.events}  InputEvents */
/** @typedef {typeof __propDef.slots}  InputSlots */

export default class Input extends __sveltets_1_createSvelteComponentTyped(__sveltets_1_partial(['foobar'], __sveltets_1_with_any_event(render()))) {
}