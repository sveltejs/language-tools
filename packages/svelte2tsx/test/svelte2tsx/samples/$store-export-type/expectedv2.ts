///<reference types="svelte" />
;
import type { Writable } from "svelte/store";
function render() {

    
    
     let store: Writable<string[]> | null = null/*Ωignore_startΩ*/;store = __sveltets_2_any(store);/*Ωignore_endΩ*//*Ωignore_startΩ*/;let $store = __sveltets_2_store_get(store);/*Ωignore_endΩ*/;
    
    if ($store) {
        $store.length
    }
;
async () => {};
return { props: {store: store}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['store'], __sveltets_2_with_any_event(render()))) {
}