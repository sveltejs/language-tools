///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_createEnsureSlot();/*Ωignore_endΩ*/
<>{__sveltets_each(items, (items) => <>
    <slot a={__sveltets_ensureSlot("default","a",items)}>Hello</slot>
</>)}</>
return { props: {}, slots: {'default': {a:__sveltets_unwrapArr(items)}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}