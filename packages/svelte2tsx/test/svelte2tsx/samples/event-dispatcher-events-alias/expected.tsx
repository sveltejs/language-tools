///<reference types="svelte" />
<></>;
import { createEventDispatcher as foo, abc } from "svelte";
function render() {

    

    const notDispatch = abc();
    const dispatch = foo();

    dispatch('hi', true);

    function bye() {
        const bla = 'bye';
        dispatch(bla, false);
    }
;
() => (<>

<button onclick={() => dispatch('btn', '')}></button></>);
return { props: {}, slots: {}, getters: {}, events: {'btn': __sveltets_customEvent, 'hi': __sveltets_customEvent, 'bye': __sveltets_customEvent} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}