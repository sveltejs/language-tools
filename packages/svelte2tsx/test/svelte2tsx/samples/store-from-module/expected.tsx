///<reference types="svelte" />
<></>;
    import {store1, store2} from './store';;let $store1 = __sveltets_store_get(store1);;let $store2 = __sveltets_store_get(store2);
    const store3 = writable('');let $store3 = __sveltets_store_get(store3);;
    const store4 = writable('');let $store4 = __sveltets_store_get(store4);;
;<></>;function render() {

    ;(__sveltets_store_get(store1), $store1);
    ;(__sveltets_store_get(store3), $store3);
;
() => (<>



<p>{(__sveltets_store_get(store2), $store2)}</p>
<p>{(__sveltets_store_get(store4), $store4)}</p></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}