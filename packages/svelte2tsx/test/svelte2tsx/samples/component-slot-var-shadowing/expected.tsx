///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<>{__sveltets_1_each(items, (items) => <>
    <slot a={__sveltets_ensureSlot("default","a",items)}>Hello</slot>
</>)}</>
return { props: {}, slots: {'default': {a:__sveltets_1_unwrapArr(items)}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}