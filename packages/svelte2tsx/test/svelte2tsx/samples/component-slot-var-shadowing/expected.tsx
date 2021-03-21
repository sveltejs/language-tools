///<reference types="svelte" />
<></>;function render() {
<>{__sveltets_each(items, (items) => <>
    <slot a={items}>Hello</slot>
</>)}</>
return { props: {}, slots: {'default': {a:__sveltets_unwrapArr(items)}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}