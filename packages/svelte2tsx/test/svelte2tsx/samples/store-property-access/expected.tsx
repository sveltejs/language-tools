///<reference types="svelte" />
<></>;function render() {

    const store = someStore()/*Ωignore_startΩ*/;let $store = __sveltets_1_store_get(store);/*Ωignore_endΩ*/;
    $store;
    $store.prop;
    $store['prop'];
    $store.prop.anotherProp;
    $store['prop'].anotherProp;
    $store.prop['anotherProp'];
    $store['prop']['anotherProp'];
    $store?.prop.anotherProp;
    $store?.prop?.anotherProp;
;
() => (<>
<p>{$store}</p>
<p>{$store.prop}</p>
<p>{$store['prop']}</p>
<p>{$store.prop.anotherProp}</p>
<p>{$store['prop'].anotherProp}</p>
<p>{$store.prop['anotherProp']}</p>
<p>{$store['prop']['anotherProp']}</p>
<p>{$store?.prop.anotherProp}</p>
<p>{$store?.prop?.anotherProp}</p></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}