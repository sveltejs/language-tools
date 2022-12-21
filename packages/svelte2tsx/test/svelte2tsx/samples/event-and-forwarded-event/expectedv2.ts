///<reference types="svelte" />
;
import { createEventDispatcher } from "svelte";
function render() {

    

    const dispatch = createEventDispatcher();
    dispatch("mount", { input });
;
async () => {

  { svelteHTML.createElement("input", { "on:focus":undefined,});}};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {'focus':__sveltets_1_mapElementEvent('focus'), 'mount': __sveltets_1_customEvent} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}