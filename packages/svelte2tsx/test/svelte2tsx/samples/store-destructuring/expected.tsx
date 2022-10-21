///<reference types="svelte" />
<></>;function render() {

    const store = fromSomewhere()/*Ωignore_startΩ*/;let $store = __sveltets_1_store_get(store);/*Ωignore_endΩ*/;
    const { store1, store2, noStore } = fromSomewhere()/*Ωignore_startΩ*/;let $store1 = __sveltets_1_store_get(store1);;let $store2 = __sveltets_1_store_get(store2);/*Ωignore_endΩ*/;
    const [ store3, store4, noStore ] = fromSomewhere()/*Ωignore_startΩ*/;let $store3 = __sveltets_1_store_get(store3);;let $store4 = __sveltets_1_store_get(store4);/*Ωignore_endΩ*/;
;
() => (<>
<p>{$store}</p>
<p>{$store1}</p>
<p>{$store2}</p>
<p>{$store3}</p>
<p>{$store4}</p></>);
return { props: {}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}