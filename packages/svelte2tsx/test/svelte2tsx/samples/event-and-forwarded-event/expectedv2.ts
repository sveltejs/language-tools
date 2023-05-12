///<reference types="svelte" />
;
import { createEventDispatcher } from "svelte";
function render() {

    

    const dispatch = createEventDispatcher();
    dispatch("mount", { input });
;
async () => {

  { svelteHTML.createElement("input", { "on:focus":undefined,});}};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {'focus':__sveltets_2_mapElementEvent('focus'), 'mount': __sveltets_2_customEvent} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}