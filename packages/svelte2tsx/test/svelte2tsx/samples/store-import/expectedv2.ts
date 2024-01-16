///<reference types="svelte" />
;
import storeA from './store';
import { storeB } from './store';
import { storeB as storeC } from './store';
function render() {
/*Ωignore_startΩ*/;let $storeA = __sveltets_2_store_get(storeA);;let $storeB = __sveltets_2_store_get(storeB);;let $storeC = __sveltets_2_store_get(storeC);/*Ωignore_endΩ*/
    
    
    
;
async () => {

 { svelteHTML.createElement("p", {});$storeA; }
 { svelteHTML.createElement("p", {});$storeB; }
 { svelteHTML.createElement("p", {});$storeC; }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}