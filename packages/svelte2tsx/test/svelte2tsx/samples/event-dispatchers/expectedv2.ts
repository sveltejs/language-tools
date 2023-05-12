///<reference types="svelte" />
;
import { createEventDispatcher, abc } from "svelte";
function render() {

    

    const notDispatch = abc();
    const dispatch1 = createEventDispatcher();
    const dispatch2 = createEventDispatcher();

    dispatch1('hi', true);
    dispatch2('bye', true);
;
async () => {

 { svelteHTML.createElement("button", { "on:click":undefined,}); }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {'click':__sveltets_2_mapElementEvent('click'), 'hi': __sveltets_2_customEvent, 'bye': __sveltets_2_customEvent} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}