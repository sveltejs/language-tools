///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<>{__sveltets_1_each(items, (item) => <>
    <slot a={__sveltets_ensureSlot("default","a",item)} b={__sveltets_ensureSlot("default","b",{ item })} c={__sveltets_ensureSlot("default","c",{ item: 'abc' }.item)} d={__sveltets_ensureSlot("default","d",{ item: item })} e={__sveltets_ensureSlot("default","e",(__sveltets_1_store_get(item), $item))} f={__sveltets_ensureSlot("default","f",(__sveltets_1_store_get(item), $item))}>Hello</slot>
</>)}</>
return { props: {}, slots: {'default': {a:__sveltets_1_unwrapArr(items), b:{ item:__sveltets_1_unwrapArr(items) }, c:{ item: 'abc' }.item, d:{ item: __sveltets_1_unwrapArr(items) }, e:$item, f:$item}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}