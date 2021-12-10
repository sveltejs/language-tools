///<reference types="svelte" />
;
import { readable } from 'svelte/store';
function render() {

	
	const store = readable(Promise.resolve('test'), () => {})/*Ωignore_startΩ*/;let $store = __sveltets_1_store_get(store);/*Ωignore_endΩ*/;
;
async () => {

     { 
	 { __sveltets_2_createElement("p", {});  }
const data = await ((__sveltets_1_store_get(store), $store)); 
	data;
}};
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}