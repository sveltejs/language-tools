///<reference types="svelte" />
<></>;function render() {

    $: store.set( __sveltets_invalidate(() => (__sveltets_store_get(store), $store) + 1));
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}