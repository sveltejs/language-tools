///<reference types="svelte" />
<></>;function render() {

    $: store.set( __sveltets_1_invalidate(() => (__sveltets_1_store_get(store), $store) + 1));
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}