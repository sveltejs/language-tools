///<reference types="svelte" />
<></>;
import { createEventDispatcher, abc } from "svelte";
function render() {

    

    const notDispatch = abc();
    const bla = 'bye';
    const dispatch = createEventDispatcher<{hi: boolean; [bla]: boolean; btn: string;}>();

    dispatch('hi', true);

    function bye() {
        dispatch(bla, false);
    }
;
() => (<>

<button onclick={() => dispatch('btn', '')}></button></>);
return { props: {}, slots: {}, getters: {}, events: {} as unknown as __sveltets_toEventTypings<{hi: boolean; [bla]: boolean; btn: string;}>() }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}