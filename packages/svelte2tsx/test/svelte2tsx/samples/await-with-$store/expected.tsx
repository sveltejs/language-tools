///<reference types="svelte" />
<></>;
import { readable } from 'svelte/store';
function render() {

	
	const store = readable(Promise.resolve('test'), () => {})/*Ωignore_startΩ*/;let $store = __sveltets_store_get(store);/*Ωignore_endΩ*/;
;
() => (<>

{() => {let _$$p = ((__sveltets_store_get(store), $store)); <>
	<p>loading</p>
</>; __sveltets_awaitThen(_$$p, (data) => {<>
	{data}
</>})}}</>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}