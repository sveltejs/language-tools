///<reference types="svelte" />
<></>;function render() {

    const store1 = '', store2 = '';let $store1 = __sveltets_store_get(store1);;let $store2 = __sveltets_store_get(store2);;
    const { store3, store4 } = '', [ store5, store6 ] = '';let $store3 = __sveltets_store_get(store3);;let $store4 = __sveltets_store_get(store4);;let $store5 = __sveltets_store_get(store5);;let $store6 = __sveltets_store_get(store6);;
    let  {store7, store8} = __sveltets_invalidate(() => '');;let $store7 = __sveltets_store_get(store7);;let $store8 = __sveltets_store_get(store8);
    let  [store9, store10] = __sveltets_invalidate(() => '');;let $store9 = __sveltets_store_get(store9);;let $store10 = __sveltets_store_get(store10);
;
() => (<>

{(__sveltets_store_get(store1), $store1)}
{(__sveltets_store_get(store2), $store2)}
{(__sveltets_store_get(store3), $store3)}
{(__sveltets_store_get(store4), $store4)}
{(__sveltets_store_get(store5), $store5)}
{(__sveltets_store_get(store6), $store6)}
{(__sveltets_store_get(store7), $store7)}
{(__sveltets_store_get(store8), $store8)}
{(__sveltets_store_get(store9), $store9)}
{(__sveltets_store_get(store10), $store10)}</>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}