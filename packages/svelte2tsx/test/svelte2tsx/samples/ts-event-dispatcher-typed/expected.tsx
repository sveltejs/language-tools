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
return { props: {}, slots: {}, getters: {}, events: {...__sveltets_1_toEventTypings<{
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

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_with_any_event(render())) {
}