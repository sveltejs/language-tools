///<reference types="svelte" />
;
import { readable } from 'svelte/store';
function render() {

	
	const store = readable(Promise.resolve('test'), () => {})/*Ωignore_startΩ*/;let $store = __sveltets_1_store_get(store);/*Ωignore_endΩ*/;
;
async () => {

   { 
	 { svelteHTML.createElement("p", {});  }
const $$_value = await ((__sveltets_1_store_get(store), $store));{ const data = $$_value; 
	data;
}}};
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}