///<reference types="svelte" />
<></>;function render() {

    const store = writable([])/*Ωignore_startΩ*/;let $store = __sveltets_store_get(store);/*Ωignore_endΩ*/;

    ;(__sveltets_store_get(store), $store)[1] = true;
    ;(__sveltets_store_get(store), $store).foo = true;

    ;(__sveltets_store_get(store), $store)[1] = true
    ;(__sveltets_store_get(store), $store).foo = true

    store.set( true)
    store.set( true);

    hello[(__sveltets_store_get(store), $store)] = true;

    store.set( true),
    store.set( false),
    (__sveltets_store_get(store), $store),
    (__sveltets_store_get(store), $store).a = true

    ;(__sveltets_store_get(store), $store).a = true,
    (__sveltets_store_get(store), $store).b = false;
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, setters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}