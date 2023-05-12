///<reference types="svelte" />
;
import { createEventDispatcher } from "svelte";
function render() {

    

    type Events = {
        hi: boolean;
        bye: boolean;
        btn: string;
    };

    const dispatch = createEventDispatcher<Events>();

    dispatch('hi', true);

    function bye() {
        const bla = 'bye';
        dispatch(bla, false);
    }
;
async () => {

 { svelteHTML.createElement("button", {  "on:click":() => dispatch('btn', ''),}); }};
return { props: {} as Record<string, never>, slots: {}, events: {...__sveltets_2_toEventTypings<Events>()} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}