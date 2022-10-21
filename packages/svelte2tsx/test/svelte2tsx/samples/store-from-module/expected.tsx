///<reference types="svelte" />
<></>;
    import {store1, store2} from './store';
    const store3 = writable('')/*Ωignore_startΩ*/;let $store3 = __sveltets_1_store_get(store3);/*Ωignore_endΩ*/;
    const store4 = writable('')/*Ωignore_startΩ*/;let $store4 = __sveltets_1_store_get(store4);/*Ωignore_endΩ*/;
;<></>;function render() {
/*Ωignore_startΩ*/;let $store1 = __sveltets_1_store_get(store1);;let $store2 = __sveltets_1_store_get(store2);/*Ωignore_endΩ*/
    $store1;
    $store3;
;
() => (<>



<p>{$store2}</p>
<p>{$store4}</p></>);
return { props: {}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}