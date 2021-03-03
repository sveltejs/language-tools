///<reference types="svelte" />
<></>;function render() {

    let  store = __sveltets_invalidate(() => fromSomewhere());;let $store = __sveltets_store_get(store);
    let  { store1, noStore } = __sveltets_invalidate(() => fromSomewhere());;let $store1 = __sveltets_store_get(store1);
    let  [ store2, noStore ] = __sveltets_invalidate(() => fromSomewhere());;let $store2 = __sveltets_store_get(store2);
;
() => (<>
<p>{(__sveltets_store_get(store), $store)}</p>
<p>{(__sveltets_store_get(store1), $store1)}</p>
<p>{(__sveltets_store_get(store2), $store2)}</p></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}