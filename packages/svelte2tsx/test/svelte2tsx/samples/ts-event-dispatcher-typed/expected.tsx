///<reference types="svelte" />
<></>;
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
() => (<>

<button onclick={() => dispatch('btn', '')}></button></>);
return { props: {}, slots: {}, getters: {}, setters: {}, events: __sveltets_toEventTypings<{
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
    btn: string;}>() }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial_ts(__sveltets_with_any_event(render))) {
}