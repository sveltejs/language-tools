///<reference types="svelte" />
<></>;
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
() => (<>

<button onclick={undefined}></button></>);
return { props: {}, slots: {}, getters: {}, events: {...__sveltets_1_toEventTypings<{
    /**
     * A DOC
     */
    hi: boolean;
    }>(), ...__sveltets_1_toEventTypings<{hi: string;}>(), 'click':__sveltets_1_mapElementEvent('click'), 'hi': __sveltets_1_customEvent, 'bye': __sveltets_1_customEvent} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_with_any_event(render())) {
}