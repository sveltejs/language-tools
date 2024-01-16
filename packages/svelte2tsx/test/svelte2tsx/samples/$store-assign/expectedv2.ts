///<reference types="svelte" />
;function render() {

    const store = writable([])/*Ωignore_startΩ*/;let $store = __sveltets_2_store_get(store);/*Ωignore_endΩ*/;

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
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}