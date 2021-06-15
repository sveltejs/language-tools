///<reference types="svelte" />
<></>;
import { createEventDispatcher } from 'svelte';
function render() {

    

    const dispatch = createEventDispatcher();
    dispatch('foo');
;
() => (<>

<button onclick={undefined}>d</button></>);
return { props: {}, slots: {}, getters: {}, events: {'click':__sveltets_mapElementEvent('click'), 'foo': __sveltets_customEvent} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render())) {
}