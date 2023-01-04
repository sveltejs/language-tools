///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<>{__sveltets_1_each(items, (item) => <>
    <slot a={__sveltets_ensureSlot("default","a",item)} b={__sveltets_ensureSlot("default","b",{ item })} c={__sveltets_ensureSlot("default","c",{ item: 'abc' }.item)} d={__sveltets_ensureSlot("default","d",{ item: item })} e={__sveltets_ensureSlot("default","e",$item)} f={__sveltets_ensureSlot("default","f",$item)} {...g} {...item}>Hello</slot>
</>)}</>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:__sveltets_2_unwrapArr(items), b:{ item:__sveltets_2_unwrapArr(items) }, c:{ item: 'abc' }.item, d:{ item: __sveltets_2_unwrapArr(items) }, e:$item, f:$item, ...g, ...__sveltets_2_unwrapArr(items)}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}