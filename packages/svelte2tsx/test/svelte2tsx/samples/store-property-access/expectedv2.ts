///<reference types="svelte" />
;function render() {

    const store = someStore()/*Ωignore_startΩ*/;let $store = __sveltets_2_store_get(store);/*Ωignore_endΩ*/;
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
async () => {
 { svelteHTML.createElement("p", {});$store; }
 { svelteHTML.createElement("p", {});$store.prop; }
 { svelteHTML.createElement("p", {});$store['prop']; }
 { svelteHTML.createElement("p", {});$store.prop.anotherProp; }
 { svelteHTML.createElement("p", {});$store['prop'].anotherProp; }
 { svelteHTML.createElement("p", {});$store.prop['anotherProp']; }
 { svelteHTML.createElement("p", {});$store['prop']['anotherProp']; }
 { svelteHTML.createElement("p", {});$store?.prop.anotherProp; }
 { svelteHTML.createElement("p", {});$store?.prop?.anotherProp; }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}