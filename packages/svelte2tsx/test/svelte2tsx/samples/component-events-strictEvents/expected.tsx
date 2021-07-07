///<reference types="svelte" />
<></>;
import { createEventDispatcher } from 'svelte';
function render() {

    

    const dispatch = createEventDispatcher();
    dispatch('foo');
;
() => (<>

<button onclick={undefined}>d</button></>);
return { props: {}, slots: {}, getters: {}, events: {'click':__sveltets_1_mapElementEvent('click'), 'foo': __sveltets_1_customEvent} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(render())) {
}