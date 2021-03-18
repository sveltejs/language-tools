///<reference types="svelte" />
<></>;function render() {
<>{__sveltets_each(items, (item) => <>
    <slot a={item}>Hello</slot>
</>)}
{__sveltets_each(items2, ({ a }) => <>
    <slot name="second" a={a}>Hello</slot>
</>)}</>
return { props: {}, slots: {'default': {a:__sveltets_unwrapArr(items)}, 'second': {a:(({ a }) => a)(__sveltets_unwrapArr(items2))}}, getters: {}, setters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
