///<reference types="svelte" />
;function render() {

    const store = writable([])/*Ωignore_startΩ*/;let $store = __sveltets_1_store_get(store);/*Ωignore_endΩ*/;

    $store[1] = true;
    $store.foo = true;

    $store[1] = true
    $store.foo = true

    $store = true
    $store = true;

    hello[$store] = true;

    $store = true,
    $store = false,
    $store,
    $store.a = true

    $store.a = true,
    $store.b = false;
;
async () => {};
return { props: {}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}