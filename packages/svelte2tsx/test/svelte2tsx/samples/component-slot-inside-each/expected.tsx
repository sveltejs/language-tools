///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<>{__sveltets_1_each(items, (item) => <>
    <slot a={__sveltets_ensureSlot("default","a",item)}>Hello</slot>
</>)}
{__sveltets_1_each(items2, ({ a }) => <>
    <slot name="second" a={__sveltets_ensureSlot("second","a",a)}>Hello</slot>
</>)}</>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:__sveltets_2_unwrapArr(items)}, 'second': {a:(({ a }) => a)(__sveltets_2_unwrapArr(items2))}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}