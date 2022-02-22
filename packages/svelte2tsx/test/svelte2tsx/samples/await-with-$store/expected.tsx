///<reference types="svelte" />
<></>;
import { readable } from 'svelte/store';
function render() {

	
	const store = readable(Promise.resolve('test'), () => {})/*Ωignore_startΩ*/;let $store = __sveltets_1_store_get(store);/*Ωignore_endΩ*/;
;
() => (<>

{() => {let _$$p = ((__sveltets_1_store_get(store), $store)); <>
	<p>loading</p>
</>; __sveltets_1_awaitThen(_$$p, (data) => {<>
	{data}
</>})}}</>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}