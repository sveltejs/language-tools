///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<>{__sveltets_1_each(items, (items) => <>
    <slot a={__sveltets_ensureSlot("default","a",items)}>Hello</slot>
</>)}</>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:__sveltets_2_unwrapArr(items)}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}