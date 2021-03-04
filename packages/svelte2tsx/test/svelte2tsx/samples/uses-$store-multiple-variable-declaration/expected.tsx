///<reference types="svelte" />
<></>;function render() {

    const store1 = '', store2 = '';let $store1 = __sveltets_store_get(store1);;let $store2 = __sveltets_store_get(store2);;
    const { store3 } = '', [ store ] = '';let $store3 = __sveltets_store_get(store3);;
    let  {store5} = __sveltets_invalidate(() => '');;let $store5 = __sveltets_store_get(store5);
    let  [store6] = __sveltets_invalidate(() => '');;let $store6 = __sveltets_store_get(store6);
;
() => (<>

{(__sveltets_store_get(store1), $store1)}
{(__sveltets_store_get(store2), $store2)}
{(__sveltets_store_get(store3), $store3)}
{(__sveltets_store_get(store4), $store4)}
{(__sveltets_store_get(store5), $store5)}
{(__sveltets_store_get(store6), $store6)}</>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}