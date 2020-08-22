///<reference types="svelte" />
<></>;function render() {
<>{__sveltets_each(items, (item) => <>
    {__sveltets_each(item, ({ a }) => <>
        <slot a={a}>Hello</slot>
    </>)}
</>)}</>
return { props: {}, slots: {default: {a:(({ a }) => a)(__sveltets_unwrapArr(__sveltets_unwrapArr(items)))}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
