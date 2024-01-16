///<reference types="svelte" />
;
    import {store1, store2} from './store';
    const store3 = writable('')/*Ωignore_startΩ*/;let $store3 = __sveltets_2_store_get(store3);/*Ωignore_endΩ*/;
    const store4 = writable('')/*Ωignore_startΩ*/;let $store4 = __sveltets_2_store_get(store4);/*Ωignore_endΩ*/;
;;function render() {
/*Ωignore_startΩ*/;let $store1 = __sveltets_2_store_get(store1);;let $store2 = __sveltets_2_store_get(store2);/*Ωignore_endΩ*/
    $store1;
    $store3;
;
async () => {



 { svelteHTML.createElement("p", {});$store2; }
 { svelteHTML.createElement("p", {});$store4; }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}