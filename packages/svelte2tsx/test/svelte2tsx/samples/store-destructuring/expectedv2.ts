///<reference types="svelte" />
;function render() {

    const store = fromSomewhere()/*Ωignore_startΩ*/;let $store = __sveltets_2_store_get(store);/*Ωignore_endΩ*/;
    const { store1, store2, noStore } = fromSomewhere()/*Ωignore_startΩ*/;let $store1 = __sveltets_2_store_get(store1);;let $store2 = __sveltets_2_store_get(store2);/*Ωignore_endΩ*/;
    const [ store3, store4, noStore ] = fromSomewhere()/*Ωignore_startΩ*/;let $store3 = __sveltets_2_store_get(store3);;let $store4 = __sveltets_2_store_get(store4);/*Ωignore_endΩ*/;
;
async () => {
 { svelteHTML.createElement("p", {});$store; }
 { svelteHTML.createElement("p", {});$store1; }
 { svelteHTML.createElement("p", {});$store2; }
 { svelteHTML.createElement("p", {});$store3; }
 { svelteHTML.createElement("p", {});$store4; }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}