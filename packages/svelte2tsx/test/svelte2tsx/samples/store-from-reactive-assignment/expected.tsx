///<reference types="svelte" />
<></>;function render() {

    let  store = __sveltets_invalidate(() => fromSomewhere());;let $store = __sveltets_store_get(store);
;
() => (<>
<p>{(__sveltets_store_get(store), $store)}</p></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}