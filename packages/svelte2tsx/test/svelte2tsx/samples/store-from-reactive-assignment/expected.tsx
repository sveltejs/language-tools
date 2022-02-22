///<reference types="svelte" />
<></>;function render() {

    let  store = __sveltets_1_invalidate(() => fromSomewhere());/*Ωignore_startΩ*/;let $store = __sveltets_1_store_get(store);/*Ωignore_endΩ*/
    let  { store1, noStore } = __sveltets_1_invalidate(() => fromSomewhere());/*Ωignore_startΩ*/;let $store1 = __sveltets_1_store_get(store1);/*Ωignore_endΩ*/
    let  [ store2, noStore ] = __sveltets_1_invalidate(() => fromSomewhere());/*Ωignore_startΩ*/;let $store2 = __sveltets_1_store_get(store2);/*Ωignore_endΩ*/
;
() => (<>
<p>{(__sveltets_1_store_get(store), $store)}</p>
<p>{(__sveltets_1_store_get(store1), $store1)}</p>
<p>{(__sveltets_1_store_get(store2), $store2)}</p></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}