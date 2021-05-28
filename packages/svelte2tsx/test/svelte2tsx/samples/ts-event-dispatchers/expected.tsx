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
    const dispatch2 = createEventDispatcher<{btn: string;}>();
    const dispatch3 = createEventDispatcher();

    dispatch3('bye', true);
;
() => (<>

<button onclick={undefined}></button></>);
return { props: {}, slots: {}, getters: {}, events: {...__sveltets_toEventTypings<{
    /**
     * A DOC
     */
    hi: boolean;
    }>(), ...__sveltets_toEventTypings<{btn: string;}>(), 'click':__sveltets_mapElementEvent('click'), 'bye': __sveltets_customEvent} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_with_any_event(render())) {
}