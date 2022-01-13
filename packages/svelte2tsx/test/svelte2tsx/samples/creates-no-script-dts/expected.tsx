import { SvelteComponentTyped } from "svelte"

declare function __sveltets_1_createSvelteComponentTyped<Props, Events, Slots>(
    render: {props: Props, events: Events, slots: Slots }
): SvelteComponentConstructor<SvelteComponentTyped<Props, Events, Slots>,Svelte2TsxComponentConstructorParameters<Props>>;

function render() {

return { props: {}, slots: {'default': {}}, getters: {}, events: {'click':__sveltets_1_mapElementEvent('click')} }}
const __propDef = __sveltets_1_partial(__sveltets_1_with_any_event(render()));
/** @typedef {typeof __propDef.props}  InputProps */
/** @typedef {typeof __propDef.events}  InputEvents */
/** @typedef {typeof __propDef.slots}  InputSlots */

export default class Input extends __sveltets_1_createSvelteComponentTyped(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}