///<reference types="svelte" />
;function render() {

    const store = someStore()/*Ωignore_startΩ*/;let $store = __sveltets_1_store_get(store);/*Ωignore_endΩ*/;
    ;(__sveltets_1_store_get(store), $store);
    ;(__sveltets_1_store_get(store), $store).prop;
    ;(__sveltets_1_store_get(store), $store)['prop'];
    ;(__sveltets_1_store_get(store), $store).prop.anotherProp;
    ;(__sveltets_1_store_get(store), $store)['prop'].anotherProp;
    ;(__sveltets_1_store_get(store), $store).prop['anotherProp'];
    ;(__sveltets_1_store_get(store), $store)['prop']['anotherProp'];
    ;(__sveltets_1_store_get(store), $store)?.prop.anotherProp;
    ;(__sveltets_1_store_get(store), $store)?.prop?.anotherProp;
;
async () => {
 { svelteHTML.createElement("p", {});(__sveltets_1_store_get(store), $store); }
 { svelteHTML.createElement("p", {});(__sveltets_1_store_get(store), $store).prop; }
 { svelteHTML.createElement("p", {});(__sveltets_1_store_get(store), $store)['prop']; }
 { svelteHTML.createElement("p", {});(__sveltets_1_store_get(store), $store).prop.anotherProp; }
 { svelteHTML.createElement("p", {});(__sveltets_1_store_get(store), $store)['prop'].anotherProp; }
 { svelteHTML.createElement("p", {});(__sveltets_1_store_get(store), $store).prop['anotherProp']; }
 { svelteHTML.createElement("p", {});(__sveltets_1_store_get(store), $store)['prop']['anotherProp']; }
 { svelteHTML.createElement("p", {});(__sveltets_1_store_get(store), $store)?.prop.anotherProp; }
 { svelteHTML.createElement("p", {});(__sveltets_1_store_get(store), $store)?.prop?.anotherProp; }};
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}