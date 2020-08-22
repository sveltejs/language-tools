///<reference types="svelte" />
<></>;function render() {
<>{__sveltets_each(items, (item) => <>
    <slot a={item} b={{ item }} c={{ item: 'abc' }.item}>Hello</slot>
</>)}</>
return { props: {}, slots: {default: {a:__sveltets_unwrapArr(items), b:{ item:__sveltets_unwrapArr(items) }, c:{ item: 'abc' }.item}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
