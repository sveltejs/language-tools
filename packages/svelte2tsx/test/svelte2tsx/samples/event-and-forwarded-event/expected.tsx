///<reference types="svelte" />
<></>;
import { createEventDispatcher } from "svelte";
function render() {

    

    const dispatch = createEventDispatcher();
    dispatch("mount", { input });
;
() => (<>

<input onfocus={undefined} /></>);
return { props: {}, slots: {}, getters: {}, setters: {}, events: {'focus':__sveltets_mapElementEvent('focus'), 'mount': __sveltets_customEvent} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}