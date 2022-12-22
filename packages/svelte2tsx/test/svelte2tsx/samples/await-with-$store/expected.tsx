///<reference types="svelte" />
<></>;
import { readable } from 'svelte/store';
function render() {

	
	const store = readable(Promise.resolve('test'), () => {})/*Ωignore_startΩ*/;let $store = __sveltets_2_store_get(store);/*Ωignore_endΩ*/;
;
() => (<>

{() => {let _$$p = ($store); <>
	<p>loading</p>
</>; __sveltets_1_awaitThen(_$$p, (data) => {<>
	{data}
</>})}}</>);
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}