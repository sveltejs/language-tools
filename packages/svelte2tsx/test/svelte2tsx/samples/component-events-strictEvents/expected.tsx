///<reference types="svelte" />
<></>;
import { createEventDispatcher } from 'svelte';
function render() {

    

    const dispatch = createEventDispatcher();
    dispatch('foo');
;
() => (<>

<button onclick={undefined}>d</button></>);
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {'click':__sveltets_2_mapElementEvent('click'), 'foo': __sveltets_2_customEvent} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(render())) {
}