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
return { props: {}, slots: {}, getters: {}, events: {'click':__sveltets_mapElementEvent('click'), 'hi': __sveltets_customEvent, 'bye': __sveltets_customEvent} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}