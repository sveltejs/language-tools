///<reference types="svelte" />
;
import { createEventDispatcher, abc } from "svelte";
function render() {

    

    const notDispatch = abc();
    const dispatch1 = createEventDispatcher<{
    /**
     * A DOC
     */
    hi: boolean;
    }>();
    const dispatch2 = createEventDispatcher<{hi: string;}>();
    const dispatch3 = createEventDispatcher();

    dispatch3('bye', true);
;
async () => {

 { svelteHTML.createElement("button", { "on:click":undefined,}); }};
return { props: {} as Record<string, never>, slots: {}, events: {...__sveltets_2_toEventTypings<{
    /**
     * A DOC
     */
    hi: boolean;
    }>(), ...__sveltets_2_toEventTypings<{hi: string;}>(), 'click':__sveltets_2_mapElementEvent('click'), 'hi': __sveltets_2_customEvent, 'bye': __sveltets_2_customEvent} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}