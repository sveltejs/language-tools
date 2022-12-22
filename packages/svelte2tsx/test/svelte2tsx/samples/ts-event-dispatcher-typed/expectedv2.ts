///<reference types="svelte" />
;
import { createEventDispatcher, abc } from "svelte";
function render() {

    

    const notDispatch = abc();
    const bla = 'bye';
    const dispatch = createEventDispatcher<{
    /**
     * A DOC
     */
    hi: boolean; 
    /**
     * not this
     */
    /**
     * ANOTHER DOC
     */
    [bla]: boolean;
    // not this
    btn: string;}>();

    dispatch('hi', true);

    function bye() {
        dispatch(bla, false);
    }
;
async () => {

 { svelteHTML.createElement("button", {  "on:click":() => dispatch('btn', ''),}); }};
return { props: {} as Record<string, never>, slots: {}, events: {...__sveltets_2_toEventTypings<{
    /**
     * A DOC
     */
    hi: boolean; 
    /**
     * not this
     */
    /**
     * ANOTHER DOC
     */
    [bla]: boolean;
    // not this
    btn: string;}>()} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}