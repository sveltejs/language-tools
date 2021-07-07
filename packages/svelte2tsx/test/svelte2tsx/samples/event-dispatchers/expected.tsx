///<reference types="svelte" />
<></>;
import { createEventDispatcher, abc } from "svelte";
function render() {

    

    const notDispatch = abc();
    const dispatch1 = createEventDispatcher();
    const dispatch2 = createEventDispatcher();

    dispatch1('hi', true);
    dispatch2('bye', true);
;
() => (<>

<button onclick={undefined}></button></>);
return { props: {}, slots: {}, getters: {}, events: {'click':__sveltets_1_mapElementEvent('click'), 'hi': __sveltets_1_customEvent, 'bye': __sveltets_1_customEvent} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}