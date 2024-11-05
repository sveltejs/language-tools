///<reference types="svelte" />
;
import { createEventDispatcher, abc } from "svelte";
function render() {

    

    const notDispatch = abc();
    const dispatch = createEventDispatcher();

    dispatch('hi', true);

    function bye() {
        const bla = 'bye';
        dispatch(bla, false);
    }
;
async () => {

 { svelteHTML.createElement("button", {  "on:click":() => dispatch('btn', ''),}); }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {'btn': __sveltets_2_customEvent, 'hi': __sveltets_2_customEvent, 'bye': __sveltets_2_customEvent} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}