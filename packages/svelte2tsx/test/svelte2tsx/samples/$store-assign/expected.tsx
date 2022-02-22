///<reference types="svelte" />
<></>;function render() {

    const store = writable([])/*Ωignore_startΩ*/;let $store = __sveltets_1_store_get(store);/*Ωignore_endΩ*/;

    ;(__sveltets_1_store_get(store), $store)[1] = true;
    ;(__sveltets_1_store_get(store), $store).foo = true;

    ;(__sveltets_1_store_get(store), $store)[1] = true
    ;(__sveltets_1_store_get(store), $store).foo = true

    store.set( true)
    store.set( true);

    hello[(__sveltets_1_store_get(store), $store)] = true;

    store.set( true),
    store.set( false),
    (__sveltets_1_store_get(store), $store),
    (__sveltets_1_store_get(store), $store).a = true

    ;(__sveltets_1_store_get(store), $store).a = true,
    (__sveltets_1_store_get(store), $store).b = false;
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}