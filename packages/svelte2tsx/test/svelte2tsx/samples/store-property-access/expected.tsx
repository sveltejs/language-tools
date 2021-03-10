///<reference types="svelte" />
<></>;function render() {

    const store = someStore()/*Ωignore_startΩ*/;let $store = __sveltets_store_get(store);/*Ωignore_endΩ*/;
    ;(__sveltets_store_get(store), $store);
    ;(__sveltets_store_get(store), $store).prop;
    ;(__sveltets_store_get(store), $store)['prop'];
    ;(__sveltets_store_get(store), $store).prop.anotherProp;
    ;(__sveltets_store_get(store), $store)['prop'].anotherProp;
    ;(__sveltets_store_get(store), $store).prop['anotherProp'];
    ;(__sveltets_store_get(store), $store)['prop']['anotherProp'];
    ;(__sveltets_store_get(store), $store)?.prop.anotherProp;
    ;(__sveltets_store_get(store), $store)?.prop?.anotherProp;
;
() => (<>
<p>{(__sveltets_store_get(store), $store)}</p>
<p>{(__sveltets_store_get(store), $store).prop}</p>
<p>{(__sveltets_store_get(store), $store)['prop']}</p>
<p>{(__sveltets_store_get(store), $store).prop.anotherProp}</p>
<p>{(__sveltets_store_get(store), $store)['prop'].anotherProp}</p>
<p>{(__sveltets_store_get(store), $store).prop['anotherProp']}</p>
<p>{(__sveltets_store_get(store), $store)['prop']['anotherProp']}</p>
<p>{(__sveltets_store_get(store), $store)?.prop.anotherProp}</p>
<p>{(__sveltets_store_get(store), $store)?.prop?.anotherProp}</p></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}