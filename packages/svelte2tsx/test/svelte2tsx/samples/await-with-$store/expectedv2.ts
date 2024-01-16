///<reference types="svelte" />
;
import { readable } from 'svelte/store';
function render() {

	
	const store = readable(Promise.resolve('test'), () => {})/*Ωignore_startΩ*/;let $store = __sveltets_2_store_get(store);/*Ωignore_endΩ*/;
;
async () => {

   { 
	 { svelteHTML.createElement("p", {});  }
const $$_value = await ($store);{ const data = $$_value; 
	data;
}}};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}